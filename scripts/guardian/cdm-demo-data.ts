// CDM AMS-I.F demo data for "Sunridge Solar Farm"
// Fields mapped from cdm-ams-if-schema.json (extracted by cdm-discover-schema.ts)
// Matches existing demo-data.ts Sunridge Solar Farm project for thematic link

// PP profile — simple: just an organization name
export const CDM_PP_PROFILE = {
  field0: "Sunridge Solar Ltd",
};

// VVB profile — simple: just a VVB name
export const CDM_VVB_PROFILE = {
  field0: "Coppice Verification Bureau",
};

// Project Details sub-schema (27 required fields + 2 optional)
// Referenced by Project Description field0
const PROJECT_DETAILS = {
  field0: "50MW solar photovoltaic power plant generating clean electricity for the Nairobi grid, displacing fossil fuel generation. The project contributes to Kenya's National Climate Change Action Plan and SDG 7.",
  field1: "Energy industries (renewable/non-renewable sources)",
  field2: ["Solar PV"],
  field3: ["Greenfield"],
  field4: "Small Scale",
  field5: "-1.2921",
  field6: "36.8219",
  field7: [{ type: "Point", coordinates: [36.8219, -1.2921] }],
  field8: "The project activity is a new renewable electricity generation facility that supplies electricity to the grid. It meets the applicability conditions of AMS-I.F as the installed capacity is below 15MW per unit.",
  field9: "Sunridge Solar Ltd",
  field10: "James Mwangi",
  field11: "Chief Technical Officer",
  field12: "P.O. Box 45678, Nairobi, Kenya",
  field13: "+254-700-000-000",
  field14: "cto@sunridgesolar.example",
  field15: ["Sunridge Solar Ltd — 100% ownership"],
  field16: "None",
  field17: "None",
  field18: ["AMS-I.F: Renewable electricity generation for captive use and mini-grid"],
  field19: "2026-01-01",
  field20: [{ field0: "2026-01-01", field1: "2033-12-31" }],
  field21: [{ field0: "2026-01-01", field1: "2026-12-31" }],
  field22: "Continuous metering of electricity generated and supplied to the grid using calibrated revenue-grade meters. Data recorded hourly and aggregated monthly. Meter readings verified against utility billing records.",
  field23: "Compliant with all applicable environmental and energy laws in Kenya, including the Energy Act 2019 and NEMA regulations.",
  field24: "Contributes to SDG 7 (Affordable and Clean Energy), SDG 13 (Climate Action), and SDG 8 (Decent Work). Creates 50+ local construction jobs and 12 permanent O&M positions.",
  field25: "Demo project for Coppice Green Bond hackathon — Hedera Hello Future Apex 2026",
  field26: [],
};

// Project Description (top-level schema for add_project_bnt)
// field0 = Project Details sub-schema
// field1 = baseline emissions enum: "Other Systems" (solar displaces grid)
// field2 = activity emissions enum: "Other Renewable Energy" (solar PV)
// field11 = Net Electricity Displaced - Retrofit (MWh)
// field12 = Net Electricity Displaced - Non Retrofit (MWh)
export const CDM_PROJECT_DESCRIPTION = {
  field0: PROJECT_DETAILS,
  field1: "Other Systems",
  field2: "Other Renewable Energy",
  field11: 4200,
  field12: 0,
};

// Monitoring Report (same schema as Project Description)
// Updated with actual monitoring period data
const MONITORING_DETAILS = {
  ...PROJECT_DETAILS,
  field0: "H1 2026 monitoring report for Sunridge Solar Farm. Solar PV system operated at 84% capacity factor, generating 4,110 MWh net electricity supplied to the Nairobi grid.",
  field21: [{ field0: "2026-01-01", field1: "2026-06-30" }],
  field22: "Revenue-grade meters recorded 4,110 MWh net generation. Meter calibration certificates valid through 2027. Auxiliary consumption (inverters, tracking motors) metered separately at 90 MWh.",
};

export const CDM_MONITORING_REPORT = {
  field0: MONITORING_DETAILS,
  field1: "Other Systems",
  field2: "Other Renewable Energy",
  field11: 4110,
  field12: 0,
};

// iREC 7 fallback demo data (simpler — device registration + issue request)
export const IREC_APPLICATION = {
  field0: "Sunridge Solar Ltd",
};

export const IREC_DEVICE = {
  field0: "Sunridge Solar Farm",
  field1: "Solar",
  field2: "Solar PV",
  field3: "Kenya",
  field4: "Nairobi",
  field5: "2026-01-01",
  field6: 50,
  field7: "MW",
  field8: "-1.2921, 36.8219",
};

export const IREC_ISSUE_REQUEST = {
  field0: "2026-01-01",
  field1: "2026-06-30",
  field2: 4110,
  field3: "MWh",
  field4: "Revenue-grade meter readings, calibrated annually",
};
