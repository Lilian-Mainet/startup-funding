# Startup-funding

**Transparent Startup Fundraising Platform on Stacks Blockchain**

Startup-funding revolutionizes startup fundraising by providing transparent, milestone-based funding with automated equity distribution and investor governance through smart contracts.

## 🌟 Key Features

### For Startups

- **Transparent Fundraising**: Create campaigns with clear funding goals and timelines
- **Milestone-Based Releases**: Access funds only after achieving verified milestones
- **Automated Equity**: Automatic equity token distribution to investors
- **Global Reach**: Accept investments from anywhere using STX tokens

### For Investors

- **Investment Transparency**: Real-time visibility into fund usage and progress
- **Governance Rights**: Vote on milestone completion before fund releases
- **Portfolio Tracking**: Monitor investments across multiple campaigns
- **Equity Tokens**: Receive proportional equity tokens for your investments

### Platform Benefits

- **2.5% Platform Fee**: Sustainable revenue model from successful raises
- **Risk Mitigation**: Milestone voting reduces investment risk
- **Compliance Ready**: Blockchain transparency aids regulatory compliance
- **Network Effects**: Growing ecosystem of startups and investors

## 📊 Smart Contract Overview

### Core Components

1. **Campaign Management**

   - Create funding campaigns with goals and deadlines
   - Track total raised funds and investor participation
   - Automatic campaign closure upon goal achievement

2. **Investment Processing**

   - Secure STX token transfers with platform fee collection
   - Automatic equity token calculation and distribution
   - Real-time portfolio updates for investors

3. **Milestone System**
   - Milestone creation with funding percentage allocation
   - Weighted voting system based on equity holdings
   - Approval-based fund release (>50% consensus required)

## 🚀 Getting Started

### Prerequisites

- Stacks wallet (Hiro Wallet recommended)
- STX tokens for investments
- Clarinet for local development

### Deployment

```bash
# Install Clarinet
npm install -g @hirosystems/clarinet-cli

# Clone repository
git clone <repository-url>
cd fundflow

# Deploy to testnet
clarinet deploy --testnet

# Deploy to mainnet
clarinet deploy --mainnet
```

### Usage Examples

#### Creating a Campaign (Founder)

```clarity
(contract-call? .fundflow create-campaign
    u"Revolutionary AI Startup"
    u"Building the next generation of AI tools for developers"
    u10000000000  ;; 10,000 STX goal
    u8640         ;; 60 days duration
    u5)           ;; 5 milestones
```

#### Investing in a Campaign

```clarity
(contract-call? .fundflow invest-in-campaign
    u1            ;; Campaign ID
    u1000000000)  ;; 1,000 STX investment
```

#### Voting on Milestones

```clarity
(contract-call? .fundflow vote-on-milestone
    u1     ;; Campaign ID
    u1     ;; Milestone ID
    true)  ;; Approve milestone
```

## 📈 Contract Functions

### Read-Only Functions

- `get-campaign-details(campaign-id)` - Retrieve campaign information
- `get-investment-details(campaign-id, investor)` - Get investment details
- `get-investor-portfolio(investor)` - View investor's portfolio
- `get-milestone-details(campaign-id, milestone-id)` - Milestone information
- `calculate-milestone-approval-rate(campaign-id, milestone-id)` - Vote results

### Public Functions

- `create-campaign()` - Start a new fundraising campaign
- `invest-in-campaign()` - Invest STX tokens in a campaign
- `create-milestone()` - Define project milestones (founder only)
- `vote-on-milestone()` - Vote on milestone completion
- `complete-milestone()` - Release funds after approval
- `close-campaign()` - End active campaign

### Administrative Functions

- `set-platform-fee()` - Adjust platform fee percentage
- `toggle-pause()` - Emergency pause functionality
- `withdraw-platform-fees()` - Collect platform revenue

## 🔒 Security Features

- **Owner-only administrative functions** with proper access control
- **Investment validation** ensuring sufficient balances
- **Duplicate vote prevention** in milestone voting
- **Deadline enforcement** for campaigns and voting periods
- **Emergency pause mechanism** for platform protection

## 💼 Business Model

- **Platform Fee**: 2.5% fee on successful investments
- **Revenue Sharing**: Transparent fee collection and withdrawal
- **Network Growth**: Incentivized ecosystem expansion
- **Compliance**: Built-in transparency for regulatory requirements

## 🛠️ Development

### Testing

```bash
# Run test suite
clarinet test

# Check contract syntax
clarinet check
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
