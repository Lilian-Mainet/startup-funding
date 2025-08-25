;; FundFlow - Transparent Startup Fundraising Platform

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-authorized (err u101))
(define-constant err-campaign-not-found (err u102))
(define-constant err-campaign-ended (err u103))
(define-constant err-insufficient-funds (err u104))
(define-constant err-invalid-parameter (err u105))
(define-constant err-milestone-not-found (err u106))
(define-constant err-already-voted (err u107))
(define-constant err-voting-period-ended (err u108))
(define-constant err-milestone-not-completed (err u109))

;; Data variables
(define-data-var total-campaigns uint u0)
(define-data-var platform-fee-percentage uint u250) ;; 2.5%
(define-data-var total-platform-fees uint u0)
(define-data-var paused bool false)

;; Campaign data structure
(define-map campaigns
    uint
    {
        founder: principal,
        title: (string-utf8 64),
        description: (string-utf8 256),
        funding-goal: uint,
        total-raised: uint,
        deadline: uint,
        active: bool,
        completed: bool,
        milestone-count: uint,
    }
)

;; Investment tracking
(define-map campaign-investments
    {
        campaign-id: uint,
        investor: principal,
    }
    {
        amount: uint,
        timestamp: uint,
        equity-tokens: uint,
    }
)

;; Milestone data structures
(define-map campaign-milestones
    {
        campaign-id: uint,
        milestone-id: uint,
    }
    {
        title: (string-utf8 64),
        description: (string-utf8 256),
        funding-percentage: uint, ;; Percentage of total funds to release
        completed: bool,
        votes-for: uint,
        votes-against: uint,
        voting-deadline: uint,
        funds-released: bool,
    }
)

;; Milestone voting tracking
(define-map milestone-votes
    {
        campaign-id: uint,
        milestone-id: uint,
        voter: principal,
    }
    {
        vote: bool, ;; true = approve, false = reject
        timestamp: uint,
        voting-power: uint, ;; Based on investment amount
    }
)

;; Read-only functions
(define-read-only (get-campaign-details (campaign-id uint))
    (map-get? campaigns campaign-id)
)

(define-read-only (get-investment-details
        (campaign-id uint)
        (investor principal)
    )
    (map-get? campaign-investments {
        campaign-id: campaign-id,
        investor: investor,
    })
)

(define-read-only (get-total-campaigns)
    (var-get total-campaigns)
)

(define-read-only (get-platform-fee-percentage)
    (var-get platform-fee-percentage)
)

(define-read-only (is-contract-paused)
    (var-get paused)
)

;; Milestone read-only functions
(define-read-only (get-milestone-details
        (campaign-id uint)
        (milestone-id uint)
    )
    (map-get? campaign-milestones {
        campaign-id: campaign-id,
        milestone-id: milestone-id,
    })
)

(define-read-only (get-milestone-vote
        (campaign-id uint)
        (milestone-id uint)
        (voter principal)
    )
    (map-get? milestone-votes {
        campaign-id: campaign-id,
        milestone-id: milestone-id,
        voter: voter,
    })
)

(define-read-only (calculate-milestone-approval-rate
        (campaign-id uint)
        (milestone-id uint)
    )
    (let ((milestone (unwrap!
            (map-get? campaign-milestones {
                campaign-id: campaign-id,
                milestone-id: milestone-id,
            })
            (err u0)
        )))
        (let ((total-votes (+ (get votes-for milestone) (get votes-against milestone))))
            (if (> total-votes u0)
                (ok (/ (* (get votes-for milestone) u100) total-votes))
                (ok u0)
            )
        )
    )
)

;; Private functions
(define-private (calculate-platform-fee (amount uint))
    (/ (* amount (var-get platform-fee-percentage)) u10000)
)

(define-private (calculate-equity-tokens
        (investment uint)
        (funding-goal uint)
    )
    ;; Simple equity calculation: (investment / funding-goal) * 10000 tokens
    (/ (* investment u10000) funding-goal)
)

;; Campaign creation and management
(define-public (create-campaign
        (title (string-utf8 64))
        (description (string-utf8 256))
        (funding-goal uint)
        (duration uint)
        (milestone-count uint)
    )
    (let ((campaign-id (+ (var-get total-campaigns) u1)))
        (begin
            (asserts! (not (var-get paused)) err-invalid-parameter)
            (asserts! (> funding-goal u0) err-invalid-parameter)
            (asserts! (> duration u0) err-invalid-parameter)
            (asserts! (and (>= milestone-count u1) (<= milestone-count u10))
                err-invalid-parameter
            )
            (map-set campaigns campaign-id {
                founder: tx-sender,
                title: title,
                description: description,
                funding-goal: funding-goal,
                total-raised: u0,
                deadline: (+ stacks-block-height duration),
                active: true,
                completed: false,
                milestone-count: milestone-count,
            })
            (var-set total-campaigns campaign-id)
            (ok campaign-id)
        )
    )
)

(define-public (invest-in-campaign
        (campaign-id uint)
        (amount uint)
    )
    (let (
            (campaign (unwrap! (map-get? campaigns campaign-id) err-campaign-not-found))
            (existing-investment (default-to {
                amount: u0,
                timestamp: u0,
                equity-tokens: u0,
            }
                (map-get? campaign-investments {
                    campaign-id: campaign-id,
                    investor: tx-sender,
                })
            ))
            (platform-fee (calculate-platform-fee amount))
            (investment-amount (- amount platform-fee))
            (equity-tokens (calculate-equity-tokens investment-amount
                (get funding-goal campaign)
            ))
        )
        (begin
            (asserts! (not (var-get paused)) err-invalid-parameter)
            (asserts! (get active campaign) err-campaign-ended)
            (asserts! (<= stacks-block-height (get deadline campaign))
                err-campaign-ended
            )
            (asserts! (> amount u0) err-invalid-parameter)
            (asserts! (>= (stx-get-balance tx-sender) amount)
                err-insufficient-funds
            )
            ;; Transfer investment to founder
            (unwrap!
                (stx-transfer? investment-amount tx-sender (get founder campaign))
                err-insufficient-funds
            )
            ;; Transfer platform fee
            (unwrap! (stx-transfer? platform-fee tx-sender contract-owner)
                err-insufficient-funds
            )
            ;; Update campaign data
            (map-set campaigns campaign-id
                (merge campaign { total-raised: (+ (get total-raised campaign) investment-amount) })
            )
            ;; Update investment record
            (map-set campaign-investments {
                campaign-id: campaign-id,
                investor: tx-sender,
            } {
                amount: (+ (get amount existing-investment) investment-amount),
                timestamp: stacks-block-height,
                equity-tokens: (+ (get equity-tokens existing-investment) equity-tokens),
            })
            ;; Update platform fees
            (var-set total-platform-fees
                (+ (var-get total-platform-fees) platform-fee)
            )
            (ok true)
        )
    )
)

(define-public (close-campaign (campaign-id uint))
    (let ((campaign (unwrap! (map-get? campaigns campaign-id) err-campaign-not-found)))
        (begin
            (asserts! (is-eq tx-sender (get founder campaign)) err-not-authorized)
            (asserts! (get active campaign) err-campaign-ended)
            (asserts!
                (or
                    (> stacks-block-height (get deadline campaign))
                    (>= (get total-raised campaign) (get funding-goal campaign))
                )
                err-invalid-parameter
            )
            (map-set campaigns campaign-id
                (merge campaign {
                    active: false,
                    completed: true,
                })
            )
            (ok true)
        )
    )
)

;; Milestone creation and management
(define-public (create-milestone
        (campaign-id uint)
        (milestone-id uint)
        (title (string-utf8 64))
        (description (string-utf8 256))
        (funding-percentage uint)
        (voting-duration uint)
    )
    (let ((campaign (unwrap! (map-get? campaigns campaign-id) err-campaign-not-found)))
        (begin
            (asserts! (is-eq tx-sender (get founder campaign)) err-not-authorized)
            (asserts! (get completed campaign) err-campaign-not-found)
            (asserts! (<= milestone-id (get milestone-count campaign))
                err-invalid-parameter
            )
            (asserts!
                (and (> funding-percentage u0) (<= funding-percentage u100))
                err-invalid-parameter
            )
            (map-set campaign-milestones {
                campaign-id: campaign-id,
                milestone-id: milestone-id,
            } {
                title: title,
                description: description,
                funding-percentage: funding-percentage,
                completed: false,
                votes-for: u0,
                votes-against: u0,
                voting-deadline: (+ stacks-block-height voting-duration),
                funds-released: false,
            })
            (ok true)
        )
    )
)

(define-public (vote-on-milestone
        (campaign-id uint)
        (milestone-id uint)
        (approve bool)
    )
    (let (
            (campaign (unwrap! (map-get? campaigns campaign-id) err-campaign-not-found))
            (milestone (unwrap!
                (map-get? campaign-milestones {
                    campaign-id: campaign-id,
                    milestone-id: milestone-id,
                })
                err-milestone-not-found
            ))
            (investment (unwrap!
                (map-get? campaign-investments {
                    campaign-id: campaign-id,
                    investor: tx-sender,
                })
                err-not-authorized
            ))
            (existing-vote (map-get? milestone-votes {
                campaign-id: campaign-id,
                milestone-id: milestone-id,
                voter: tx-sender,
            }))
            (voting-power (get equity-tokens investment))
        )
        (begin
            (asserts! (is-none existing-vote) err-already-voted)
            (asserts! (<= stacks-block-height (get voting-deadline milestone))
                err-voting-period-ended
            )
            (asserts! (> voting-power u0) err-not-authorized)
            ;; Record vote
            (map-set milestone-votes {
                campaign-id: campaign-id,
                milestone-id: milestone-id,
                voter: tx-sender,
            } {
                vote: approve,
                timestamp: stacks-block-height,
                voting-power: voting-power,
            })
            ;; Update milestone vote counts
            (map-set campaign-milestones {
                campaign-id: campaign-id,
                milestone-id: milestone-id,
            }
                (merge milestone {
                    votes-for: (if approve
                        (+ (get votes-for milestone) voting-power)
                        (get votes-for milestone)
                    ),
                    votes-against: (if (not approve)
                        (+ (get votes-against milestone) voting-power)
                        (get votes-against milestone)
                    ),
                })
            )
            (ok true)
        )
    )
)

(define-public (complete-milestone
        (campaign-id uint)
        (milestone-id uint)
    )
    (let (
            (campaign (unwrap! (map-get? campaigns campaign-id) err-campaign-not-found))
            (milestone (unwrap!
                (map-get? campaign-milestones {
                    campaign-id: campaign-id,
                    milestone-id: milestone-id,
                })
                err-milestone-not-found
            ))
            (total-votes (+ (get votes-for milestone) (get votes-against milestone)))
            (approval-rate (if (> total-votes u0)
                (/ (* (get votes-for milestone) u100) total-votes)
                u0
            ))
        )
        (begin
            (asserts! (is-eq tx-sender (get founder campaign)) err-not-authorized)
            (asserts! (> stacks-block-height (get voting-deadline milestone))
                err-voting-period-ended
            )
            (asserts! (>= approval-rate u51) err-milestone-not-completed) ;; Need >50% approval
            (asserts! (not (get funds-released milestone)) err-invalid-parameter)
            ;; Mark milestone as completed
            (map-set campaign-milestones {
                campaign-id: campaign-id,
                milestone-id: milestone-id,
            }
                (merge milestone {
                    completed: true,
                    funds-released: true,
                })
            )
            (ok true)
        )
    )
)
