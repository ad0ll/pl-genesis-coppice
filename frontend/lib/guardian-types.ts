// TypeScript types for Guardian VC data
// Field names match Guardian credentialSubject keys (PascalCase, no spaces)

export interface Indicator {
  name: string;
  value: number;
  unit: string;
}

// Raw credentialSubject shapes as returned by Guardian API

export interface BondFrameworkCS {
  BondName: string;
  BondSymbol: string;
  ISIN: string;
  Issuer: string;
  Currency: string;
  TotalIssuanceAmount: number;
  CouponRate: string;
  MaturityDate: string;
  CouponStepUpBps: number;
  SustainabilityPerformanceTarget: string;
  EligibleICMACategories: string;
  ReportingStandard: string;
  RegulatoryFrameworks?: string;
  EUTaxonomyAlignmentPercent?: number;
  BondContractAddress: string;
  LCCFContractAddress: string;
  ExternalReviewProvider?: string;
}

export interface ProjectRegistrationCS {
  ProjectName: string;
  ICMACategory: string;
  SubCategory: string;
  Country: string;
  Location: string;
  Capacity: number;
  CapacityUnit: string;
  ProjectLifetimeYears: number;
  AnnualTargetCO2e: number;
  EUTaxonomyActivityID?: string;
  NACECode?: string;
  EnvironmentalObjective?: string;
  TaxonomyAlignmentStatus?: string;
}

export interface FundAllocationCS {
  ProjectName: string;
  SignedAmountEUSD: number;
  AllocatedAmountEUSD: number;
  ShareofFinancingPercent: number;
  AllocationDate: string;
  Purpose: string;
  HederaTransactionID: string;
}

export interface MRVReportCS {
  ProjectName: string;
  ICMACategory: string;
  ReportingPeriodStart: string;
  ReportingPeriodEnd: string;
  AnnualGHGReduced: number;
  Methodology: string;
  ReportingStandard: string;
  CoreIndicatorsJSON: string;
  AdditionalIndicatorsJSON?: string;
}

export interface VerificationStatementCS {
  ProjectName: string;
  ReportingPeriod: string;
  VerifiedGHGReduced: number;
  Opinion: string;
  VerifiedCoreIndicatorsJSON?: string;
  VerifierNotes?: string;
}

// Guardian VC document wrapper (as returned by viewer block API)
export interface GuardianVCDocument<T = Record<string, unknown>> {
  createDate: string;
  updateDate: string;
  hash: string;
  hederaStatus: string;
  type: string;
  policyId: string;
  tag: string;
  schema: string;
  option: { status: string };
  owner: string;
  topicId: string;
  messageId: string;
  messageHash: string;
  document: {
    id: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    credentialSubject: T[];
    proof: {
      type: string;
      created: string;
      verificationMethod: string;
      proofPurpose: string;
      jws: string;
    };
  };
  _id: string;
  id: string;
}

// Viewer block response
export interface ViewerBlockResponse<T = Record<string, unknown>> {
  data: GuardianVCDocument<T>[];
}

// Provenance metadata extracted from VC document wrapper
export interface VCEvidence {
  hash: string;           // IPFS CID (base58)
  topicId: string;        // HCS topic ID
  messageId: string;      // HCS message timestamp
  issuer: string;         // DID of signer
  issuanceDate: string;   // ISO timestamp
  proofType: string;      // e.g. "Ed25519Signature2018"
}

// Aggregated data for frontend consumption
export interface GuardianProject {
  registration: ProjectRegistrationCS;
  registrationEvidence?: VCEvidence;
  registrationDocument?: Record<string, unknown>;
  allocation?: FundAllocationCS;
  allocationEvidence?: VCEvidence;
  allocationDocument?: Record<string, unknown>;
  mrvReport?: MRVReportCS;
  mrvEvidence?: VCEvidence;
  mrvDocument?: Record<string, unknown>;
  verification?: VerificationStatementCS;
  verificationEvidence?: VCEvidence;
  verificationDocument?: Record<string, unknown>;
  isVerified: boolean;
  verifiedCO2e: number;
  createDate: string;
}

export interface GuardianData {
  bondFramework: BondFrameworkCS | null;
  bondFrameworkEvidence?: VCEvidence;
  projects: GuardianProject[];
  totalAllocatedEUSD: number;
  totalIssuanceEUSD: number;
  allocationPercent: number;
  totalVerifiedCO2e: number;
  sptTarget: number;
  sptMet: boolean;
}

// CDM AMS-I.F types (Instance 2 — carbon methodology VCs)
// Field names use generic "fieldN" keys from Guardian schema

export interface CDMProjectDetails {
  field0: string;   // Description
  field1: string;   // Sectoral scope
  field2: string[]; // Technology (e.g. "Solar PV")
  field3: string[]; // Project type (e.g. "Greenfield")
  field4: string;   // Scale ("Small Scale")
  field5: string;   // Latitude
  field6: string;   // Longitude
  field9: string;   // PP organization name
  field18: string[]; // Methodology (e.g. "AMS-I.F: ...")
  field19: string;  // Start date
  field20: Array<{ field0: string; field1: string }>; // Crediting period
  field21: Array<{ field0: string; field1: string }>; // Monitoring period
  field22: string;  // Monitoring plan
  field24: string;  // SDG contributions
}

export interface CDMProjectCS {
  field0: CDMProjectDetails;
  field1: string;   // Baseline type ("Other Systems")
  field2: string;   // Activity type ("Other Renewable Energy")
  field11: number;  // Net electricity displaced (MWh)
  field12: number;  // Net electricity displaced non-retrofit (MWh)
}

export interface CDMProject {
  description: string;
  methodology: string;
  technology: string;
  projectParticipant: string;
  location: { lat: number; lon: number };
  startDate: string;
  creditingPeriod: { start: string; end: string };
  monitoringPeriod: { start: string; end: string };
  netElectricityMWh: number;
  sdgContributions: string;
  status: string;
  evidence: VCEvidence;
}

export interface CDMMonitoringReport {
  description: string;
  monitoringPeriod: { start: string; end: string };
  netElectricityMWh: number;
  monitoringPlan: string;
  status: string;
  evidence: VCEvidence;
}

export interface CDMData {
  projects: CDMProject[];
  reports: CDMMonitoringReport[];
  cerToken: {
    tokenId: string;
    tokenName: string;
    tokenSymbol: string;
    nftsMinted: number;
  } | null;
  policyName: string;
  policyTopicId: string;
}
