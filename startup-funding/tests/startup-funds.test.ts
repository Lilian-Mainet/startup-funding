
import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

describe("startup-funds contract", () => {
  beforeEach(() => {
    simnet.setEpoch("3.0");
  });

  describe("Campaign Management", () => {
    describe("create-campaign", () => {
      it("should create a new campaign successfully", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "create-campaign",
          [
            Cl.stringUtf8("Tech Startup"),
            Cl.stringUtf8("Revolutionary blockchain platform"),
            Cl.uint(1000000), // 1M STX funding goal
            Cl.uint(100), // 100 blocks duration
            Cl.uint(3), // 3 milestones
          ],
          wallet1
        );
        
        expect(result).toBeOk(Cl.uint(1));
        
        // Verify campaign details
        const { result: campaignDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-campaign-details",
          [Cl.uint(1)],
          wallet1
        );
        
        expect(campaignDetails).toBeSome(
          Cl.tuple({
            founder: Cl.principal(wallet1),
            title: Cl.stringUtf8("Tech Startup"),
            description: Cl.stringUtf8("Revolutionary blockchain platform"),
            "funding-goal": Cl.uint(1000000),
            "total-raised": Cl.uint(0),
            deadline: Cl.uint(simnet.blockHeight + 100),
            active: Cl.bool(true),
            completed: Cl.bool(false),
            "milestone-count": Cl.uint(3),
          })
        );
      });

      it("should fail with invalid parameters", () => {
        // Zero funding goal
        const { result: result1 } = simnet.callPublicFn(
          "startup-funds",
          "create-campaign",
          [
            Cl.stringUtf8("Test"),
            Cl.stringUtf8("Description"),
            Cl.uint(0),
            Cl.uint(100),
            Cl.uint(3),
          ],
          wallet1
        );
        expect(result1).toBeErr(Cl.uint(105));

        // Zero duration
        const { result: result2 } = simnet.callPublicFn(
          "startup-funds",
          "create-campaign",
          [
            Cl.stringUtf8("Test"),
            Cl.stringUtf8("Description"),
            Cl.uint(1000),
            Cl.uint(0),
            Cl.uint(3),
          ],
          wallet1
        );
        expect(result2).toBeErr(Cl.uint(105));

        // Too many milestones
        const { result: result3 } = simnet.callPublicFn(
          "startup-funds",
          "create-campaign",
          [
            Cl.stringUtf8("Test"),
            Cl.stringUtf8("Description"),
            Cl.uint(1000),
            Cl.uint(100),
            Cl.uint(11),
          ],
          wallet1
        );
        expect(result3).toBeErr(Cl.uint(105));
      });

      it("should increment total campaigns counter", () => {
        const { result: initialCount } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-total-campaigns",
          [],
          wallet1
        );
        expect(initialCount).toBeUint(0);

        simnet.callPublicFn(
          "startup-funds",
          "create-campaign",
          [
            Cl.stringUtf8("Campaign 1"),
            Cl.stringUtf8("First campaign"),
            Cl.uint(500000),
            Cl.uint(50),
            Cl.uint(2),
          ],
          wallet1
        );

        const { result: afterCount } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-total-campaigns",
          [],
          wallet1
        );
        expect(afterCount).toBeUint(1);
      });
    });

    describe("invest-in-campaign", () => {
      beforeEach(() => {
        // Create a campaign for testing investments
        simnet.callPublicFn(
          "startup-funds",
          "create-campaign",
          [
            Cl.stringUtf8("Investment Test"),
            Cl.stringUtf8("Campaign for testing investments"),
            Cl.uint(1000000),
            Cl.uint(100),
            Cl.uint(3),
          ],
          wallet1
        );
      });

      it("should allow investment in active campaign", () => {
        const investmentAmount = 50000;
        const platformFee = Math.floor((investmentAmount * 250) / 10000); // 2.5%
        const actualInvestment = investmentAmount - platformFee;

        const { result } = simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(1), Cl.uint(investmentAmount)],
          wallet2
        );
        
        expect(result).toBeOk(Cl.bool(true));

        // Check campaign total raised
        const { result: campaignDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-campaign-details",
          [Cl.uint(1)],
          wallet2
        );
        
        const campaign = (campaignDetails as any).value!.data;
        expect(campaign["total-raised"]).toBeUint(actualInvestment);

        // Check investment details
        const { result: investmentDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-investment-details",
          [Cl.uint(1), Cl.principal(wallet2)],
          wallet2
        );
        
        expect(investmentDetails).toBeSome(
          Cl.tuple({
            amount: Cl.uint(actualInvestment),
            timestamp: Cl.uint(simnet.blockHeight),
            "equity-tokens": Cl.uint(Math.floor((actualInvestment * 10000) / 1000000)),
          })
        );
      });

      it("should handle multiple investments from same investor", () => {
        const firstInvestment = 30000;
        const secondInvestment = 20000;
        
        simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(1), Cl.uint(firstInvestment)],
          wallet2
        );
        
        simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(1), Cl.uint(secondInvestment)],
          wallet2
        );

        const { result: investmentDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-investment-details",
          [Cl.uint(1), Cl.principal(wallet2)],
          wallet2
        );
        
        const totalInvestment = firstInvestment + secondInvestment;
        const totalFees = Math.floor((totalInvestment * 250) / 10000);
        const actualTotal = totalInvestment - totalFees;
        
        const investment = (investmentDetails as any).value!.data;
        expect(investment.amount).toBeUint(actualTotal);
      });

      it("should fail for non-existent campaign", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(999), Cl.uint(50000)],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(102));
      });

      it("should fail for expired campaign", () => {
        // Mine blocks to expire the campaign
        simnet.mineEmptyBlocks(101);
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(1), Cl.uint(50000)],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(103));
      });

      it("should fail with zero investment amount", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(1), Cl.uint(0)],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(105));
      });

      it("should update campaign statistics", () => {
        simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(1), Cl.uint(100000)],
          wallet2
        );
        
        const { result: stats } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-campaign-stats",
          [Cl.uint(1)],
          wallet2
        );
        
        expect(stats).toBeSome(
          Cl.tuple({
            "total-investors": Cl.uint(1),
            "average-investment": Cl.uint(97500), // 100000 - 2.5% fee
            "last-update": Cl.uint(simnet.blockHeight),
          })
        );
      });

      it("should update investor portfolio", () => {
        const investmentAmount = 75000;
        const actualInvestment = investmentAmount - Math.floor((investmentAmount * 250) / 10000);
        
        simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(1), Cl.uint(investmentAmount)],
          wallet2
        );
        
        const { result: portfolio } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-investor-portfolio",
          [Cl.principal(wallet2)],
          wallet2
        );
        
        expect(portfolio).toBeSome(
          Cl.tuple({
            "total-invested": Cl.uint(actualInvestment),
            "active-campaigns": Cl.uint(1),
            "total-returns": Cl.uint(0),
          })
        );
      });
    });

    describe("close-campaign", () => {
      beforeEach(() => {
        simnet.callPublicFn(
          "startup-funds",
          "create-campaign",
          [
            Cl.stringUtf8("Closable Campaign"),
            Cl.stringUtf8("Campaign for testing closure"),
            Cl.uint(500000),
            Cl.uint(50),
            Cl.uint(2),
          ],
          wallet1
        );
      });

      it("should allow founder to close campaign after deadline", () => {
        // Mine blocks to pass deadline
        simnet.mineEmptyBlocks(51);
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "close-campaign",
          [Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeOk(Cl.bool(true));
        
        // Verify campaign is closed
        const { result: campaignDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-campaign-details",
          [Cl.uint(1)],
          wallet1
        );
        
        const campaign = (campaignDetails as any).value!.data;
        expect(campaign.active).toBeBool(false);
        expect(campaign.completed).toBeBool(true);
      });

      it("should allow founder to close campaign when funding goal reached", () => {
        // Invest enough to reach goal
        simnet.callPublicFn(
          "startup-funds",
          "invest-in-campaign",
          [Cl.uint(1), Cl.uint(513000)], // Account for fees
          wallet2
        );
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "close-campaign",
          [Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeOk(Cl.bool(true));
      });

      it("should fail if not founder", () => {
        simnet.mineEmptyBlocks(51);
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "close-campaign",
          [Cl.uint(1)],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(101));
      });

      it("should fail if campaign not found", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "close-campaign",
          [Cl.uint(999)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(102));
      });

      it("should fail if deadline not passed and goal not reached", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "close-campaign",
          [Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(105));
      });

      it("should fail if campaign already closed", () => {
        simnet.mineEmptyBlocks(51);
        
        simnet.callPublicFn(
          "startup-funds",
          "close-campaign",
          [Cl.uint(1)],
          wallet1
        );
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "close-campaign",
          [Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(103));
      });
    });
  });

  describe("Milestone System", () => {
    beforeEach(() => {
      // Create and complete a campaign for milestone testing
      simnet.callPublicFn(
        "startup-funds",
        "create-campaign",
        [
          Cl.stringUtf8("Milestone Campaign"),
          Cl.stringUtf8("Campaign for testing milestones"),
          Cl.uint(1000000),
          Cl.uint(50),
          Cl.uint(3),
        ],
        wallet1
      );
      
      // Invest to reach goal and close campaign
      simnet.callPublicFn(
        "startup-funds",
        "invest-in-campaign",
        [Cl.uint(1), Cl.uint(1026000)], // Account for fees
        wallet2
      );
      
      simnet.callPublicFn(
        "startup-funds",
        "close-campaign",
        [Cl.uint(1)],
        wallet1
      );
    });

    describe("create-milestone", () => {
      it("should create a milestone successfully", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1), // campaign-id
            Cl.uint(1), // milestone-id
            Cl.stringUtf8("MVP Development"),
            Cl.stringUtf8("Complete minimum viable product"),
            Cl.uint(30), // 30% funding release
            Cl.uint(50), // 50 blocks voting duration
          ],
          wallet1
        );
        
        expect(result).toBeOk(Cl.bool(true));
        
        // Verify milestone details
        const { result: milestoneDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-milestone-details",
          [Cl.uint(1), Cl.uint(1)],
          wallet1
        );
        
        expect(milestoneDetails).toBeSome(
          Cl.tuple({
            title: Cl.stringUtf8("MVP Development"),
            description: Cl.stringUtf8("Complete minimum viable product"),
            "funding-percentage": Cl.uint(30),
            completed: Cl.bool(false),
            "votes-for": Cl.uint(0),
            "votes-against": Cl.uint(0),
            "voting-deadline": Cl.uint(simnet.blockHeight + 50),
            "funds-released": Cl.bool(false),
          })
        );
      });

      it("should fail if not campaign founder", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1),
            Cl.uint(1),
            Cl.stringUtf8("Unauthorized Milestone"),
            Cl.stringUtf8("This should fail"),
            Cl.uint(25),
            Cl.uint(30),
          ],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(101));
      });

      it("should fail for non-existent campaign", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(999),
            Cl.uint(1),
            Cl.stringUtf8("Invalid Campaign"),
            Cl.stringUtf8("Campaign does not exist"),
            Cl.uint(25),
            Cl.uint(30),
          ],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(102));
      });

      it("should fail with invalid funding percentage", () => {
        // Zero funding percentage
        const { result: result1 } = simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1),
            Cl.uint(1),
            Cl.stringUtf8("Invalid Percentage"),
            Cl.stringUtf8("Zero percentage should fail"),
            Cl.uint(0),
            Cl.uint(30),
          ],
          wallet1
        );
        expect(result1).toBeErr(Cl.uint(105));

        // Over 100% funding percentage
        const { result: result2 } = simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1),
            Cl.uint(1),
            Cl.stringUtf8("Invalid Percentage"),
            Cl.stringUtf8("Over 100% should fail"),
            Cl.uint(101),
            Cl.uint(30),
          ],
          wallet1
        );
        expect(result2).toBeErr(Cl.uint(105));
      });

      it("should fail if milestone-id exceeds milestone-count", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1),
            Cl.uint(4), // Campaign has only 3 milestones
            Cl.stringUtf8("Excess Milestone"),
            Cl.stringUtf8("This should fail"),
            Cl.uint(25),
            Cl.uint(30),
          ],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(105));
      });
    });

    describe("vote-on-milestone", () => {
      beforeEach(() => {
        // Create a milestone for voting tests
        simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1),
            Cl.uint(1),
            Cl.stringUtf8("Voting Test Milestone"),
            Cl.stringUtf8("Milestone for testing voting"),
            Cl.uint(40),
            Cl.uint(50),
          ],
          wallet1
        );
      });

      it("should allow investor to vote on milestone", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(1), Cl.bool(true)], // Approve vote
          wallet2
        );
        
        expect(result).toBeOk(Cl.bool(true));
        
        // Check vote record
        const { result: voteDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-milestone-vote",
          [Cl.uint(1), Cl.uint(1), Cl.principal(wallet2)],
          wallet2
        );
        
        expect(voteDetails).toBeSome(
          Cl.tuple({
            vote: Cl.bool(true),
            timestamp: Cl.uint(simnet.blockHeight),
            "voting-power": Cl.uint(10003), // Based on actual investment amount after fees and equity calculation
          })
        );
        
        // Check milestone vote counts updated
        const { result: milestoneDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-milestone-details",
          [Cl.uint(1), Cl.uint(1)],
          wallet2
        );
        
        const milestone = (milestoneDetails as any).value!.data;
        expect(milestone["votes-for"]).toBeUint(10003);
        expect(milestone["votes-against"]).toBeUint(0);
      });

      it("should allow reject vote on milestone", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(1), Cl.bool(false)], // Reject vote
          wallet2
        );
        
        expect(result).toBeOk(Cl.bool(true));
        
        // Check milestone vote counts updated
        const { result: milestoneDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-milestone-details",
          [Cl.uint(1), Cl.uint(1)],
          wallet2
        );
        
        const milestone = (milestoneDetails as any).value!.data;
        expect(milestone["votes-for"]).toBeUint(0);
        expect(milestone["votes-against"]).toBeUint(10003);
      });

      it("should fail if user already voted", () => {
        // First vote
        simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
          wallet2
        );
        
        // Second vote should fail
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(1), Cl.bool(false)],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(107));
      });

      it("should fail if user has no investment", () => {
        // wallet1 (founder) has no investment, only wallet2 invested
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(101));
      });

      it("should fail if voting period ended", () => {
        // Mine blocks to expire voting period
        simnet.mineEmptyBlocks(51);
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(108));
      });

      it("should fail for non-existent milestone", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(999), Cl.bool(true)],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(106));
      });
    });

    describe("complete-milestone", () => {
      beforeEach(() => {
        // Create milestone and vote to approve it
        simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1),
            Cl.uint(1),
            Cl.stringUtf8("Completion Test"),
            Cl.stringUtf8("Milestone for testing completion"),
            Cl.uint(50),
            Cl.uint(30),
          ],
          wallet1
        );
        
        // Vote to approve
        simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
          wallet2
        );
      });

      it("should complete milestone with sufficient approval", () => {
        // Wait for voting period to end
        simnet.mineEmptyBlocks(31);
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "complete-milestone",
          [Cl.uint(1), Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeOk(Cl.bool(true));
        
        // Verify milestone is completed
        const { result: milestoneDetails } = simnet.callReadOnlyFn(
          "startup-funds",
          "get-milestone-details",
          [Cl.uint(1), Cl.uint(1)],
          wallet1
        );
        
        const milestone = (milestoneDetails as any).value!.data;
        expect(milestone.completed).toBeBool(true);
        expect(milestone["funds-released"]).toBeBool(true);
      });

      it("should fail if not campaign founder", () => {
        simnet.mineEmptyBlocks(31);
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "complete-milestone",
          [Cl.uint(1), Cl.uint(1)],
          wallet2
        );
        
        expect(result).toBeErr(Cl.uint(101));
      });

      it("should fail if voting period not ended", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "complete-milestone",
          [Cl.uint(1), Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(108));
      });

      it("should fail with insufficient approval", () => {
        // Create another milestone with rejection vote
        simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1),
            Cl.uint(2),
            Cl.stringUtf8("Rejected Milestone"),
            Cl.stringUtf8("This will be rejected"),
            Cl.uint(30),
            Cl.uint(20),
          ],
          wallet1
        );
        
        // Vote to reject
        simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(2), Cl.bool(false)],
          wallet2
        );
        
        // Wait for voting period to end
        simnet.mineEmptyBlocks(21);
        
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "complete-milestone",
          [Cl.uint(1), Cl.uint(2)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(109));
      });

      it("should fail for non-existent milestone", () => {
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "complete-milestone",
          [Cl.uint(1), Cl.uint(999)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(106));
      });

      it("should fail if funds already released", () => {
        simnet.mineEmptyBlocks(31);
        
        // Complete milestone first time
        simnet.callPublicFn(
          "startup-funds",
          "complete-milestone",
          [Cl.uint(1), Cl.uint(1)],
          wallet1
        );
        
        // Try to complete again
        const { result } = simnet.callPublicFn(
          "startup-funds",
          "complete-milestone",
          [Cl.uint(1), Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(105));
      });
    });

    describe("calculate-milestone-approval-rate", () => {
      beforeEach(() => {
        simnet.callPublicFn(
          "startup-funds",
          "create-milestone",
          [
            Cl.uint(1),
            Cl.uint(1),
            Cl.stringUtf8("Approval Test"),
            Cl.stringUtf8("Testing approval calculation"),
            Cl.uint(25),
            Cl.uint(40),
          ],
          wallet1
        );
      });

      it("should calculate approval rate correctly with votes", () => {
        // Add another investor for more complex voting
        simnet.callPublicFn(
          "startup-funds",
          "create-campaign",
          [
            Cl.stringUtf8("Second Campaign"),
            Cl.stringUtf8("For additional investor"),
            Cl.uint(500000),
            Cl.uint(30),
            Cl.uint(2),
          ],
          wallet1
        );
        
        // Vote on original milestone
        simnet.callPublicFn(
          "startup-funds",
          "vote-on-milestone",
          [Cl.uint(1), Cl.uint(1), Cl.bool(true)],
          wallet2
        );
        
        const { result } = simnet.callReadOnlyFn(
          "startup-funds",
          "calculate-milestone-approval-rate",
          [Cl.uint(1), Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeOk(Cl.uint(100)); // 100% approval with only positive votes
      });

      it("should return 0% for milestone with no votes", () => {
        const { result } = simnet.callReadOnlyFn(
          "startup-funds",
          "calculate-milestone-approval-rate",
          [Cl.uint(1), Cl.uint(1)],
          wallet1
        );
        
        expect(result).toBeOk(Cl.uint(0));
      });

      it("should fail for non-existent milestone", () => {
        const { result } = simnet.callReadOnlyFn(
          "startup-funds",
          "calculate-milestone-approval-rate",
          [Cl.uint(1), Cl.uint(999)],
          wallet1
        );
        
        expect(result).toBeErr(Cl.uint(0));
      });
    });
  });
});
