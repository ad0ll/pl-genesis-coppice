

## SECTION 0 INTRO:

Coppice is a hybrid green bond on Hedera that combines use-of-proceeds tracking with sustainability-linked coupon penalties.

It's designed to ensures that the financial incentives of the green bond issuer align with the climate change outcomes the investors expect.

Coppice is built on top of Hedera's Asset Tokenization Studio, for compliant bond issuance, and Guardian for tracking environmental impact as Verifiable Credentials.

Let me walk you through it.


## SECTION 1 INVEST:

Green bonds, like any bond, are a regulated security with varying compliance requirements by country.

You can see here, I'm blocked from investing because I don't have those records on chain for Germany...

In production, a regulated KYC provider would issue these credentials, or we'd handle it through the Tokenization Studio UI. 

For the demo and judges, I just have a button here to self-deploy the ERC-3643 identity contract and issue the compliance claims.


Great, now I can invest.

I deployed a custom HTS stablecoin for settlement since Circle is stingy about handing out testnet USDC, there's a faucet here.

Let's purchase 100 CPC tokens
Let's grab some eUSD and purchase 100 CPC tokens. CPC is our RWA token that represents a share of the Coppice Green Bond.

Behind the scenes, this issuance goes through ATS, which verifies identity and compliance before issuing the CPC tokens via ERC-1594.

Great, now I'm a bondholder.


## SECTION 2 ISSUER

 Now let me switch to the issuer's side.

 This would usually be locked down, but for the judges, there's a button here that will grant you a role that lets you use this page.

 Alright, now I'm an agent of Coppice.

This page is an all in one administrative dashboard for issuers, it has several important reports as well as controls for interacting w/ ATS and Guardian.

 Key stats are at the top, coming from on-chain data and Guardian. There I am in the holders table...
 

 Then this "Proceeds Allocated" number comes from Guardian. We've allocated most of the proceeds, but we haven't hit our CO2 reduction target. This is a problem, for us, the issuer, at least.

 What does that mean?



One of the biggest issues investors have with green bonds is greenwashing — when an issuer invests funds into projects that look good on the surface, but don't really move the needle on climate change in application. 

To address this, coupon distributions in Coppice are to a Sustainability Performance Target — the SPT.

If we fail to hit our SPT, like we are now, we'll have to pay a 25 basis points penalty when we issue a coupon. 

This is what a Sustainability Linked Bond is, and why Coppice is a hybridge Green Bond and Sustainability linked bond.

Green bonds are just bonds with guidelines on how the issuer should invest.

 Sustainability-linked provide a financial penalty to the bond issuer should they fail to meet their sustainability targets.


Coppice combines both so the financial incentives of the bond align with the environmental outcomes investors expect. 

## SECTION 3 Create coupon

Let me create a coupon now so we can see payouts later... you can see a non-penalty payout is rejected, so let me eat the cost...

I'll create a coupon at the penalty rate — 4.50%. That goes on-chain as a real coupon on the ATS bond contract. I've set the execution date a few minutes from now so we can distribute it live later.

## SECTION 4 ALLOCATE
Alright, so let's allocate some funds.

Coppice right now lets you create projects to invest in so the demo is a closed loop, but in a production system, we'd invest in and interact with other projects based on Guardian.

Our Guardian instance would then ensure that we can only invest in projects with metadata indicating they belong to an eligible ICMA Green Bond Principles category, which would be checked and rejected when gaurdian attempts to produce a VC

In the demo we enforce this with an enum, but in production we'd use HIP-19


We've done a lot of stuff. If you want to see a full trail from HCS, there's an audit log with scanner links down here. You can see what we've done so far is here.


## SECTION 5: Impact Page -- The Evidence [3:30 - 4:10]


  Now, to address greenwashing — investors need to know where their money went, and whether it actually made an impact.

  This can be found under the impact view. 
  
  For each project the bond funds, you can see the use of proceeds — what the project is, how much was
  allocated, what environmental outcomes were measured, and whether an independent verifier confirmed them. 
  
  For those familiar with green bonds, this is MRV
  
  Each step in this chain is a Verifiable Credential stored in Guardian, produced on demand when a project reports its outcomes.
  
  Right now the environmental data is submitted manually through Guardian. In a later version though, we could automate reporting with digital MRV by streaming data from sensors and other projects.

## SECTION 5b: Decentralized Storage — Storacha + Filecoin

Now if I scroll down a bit, there's this Decentralized Storage section.

So all those Verifiable Credentials we just looked at — the registrations, allocations, MRV reports, verifications — Guardian is storing those on IPFS through Storacha.

Storacha automatically creates Filecoin mainnet storage deals for everything it touches, so this evidence isn't just sitting on our Guardian server. It's persisted on Filecoin.

You can see all 13 documents here with their CIDs. I can click "View" on any of them to pull the raw VC back from IPFS.

The key thing is this data integrity chain at the bottom — Hedera HCS gives us timestamps, IPFS gives us content addressing, and Filecoin gives us persistent storage. So even if our Guardian server goes down, the anti-greenwashing evidence is still out there and verifiable.

That matters because this evidence needs to hold up years from now, not just during the demo.

## Section 6: Distribution

Moving on

The coupon I created earlier is ready. Let's distribute.

Distribution takes an on-chain snapshot of every holder's balance, then executes a mass payout through the LifeCycleCashFlow contract.
