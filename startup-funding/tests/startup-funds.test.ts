
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
});
