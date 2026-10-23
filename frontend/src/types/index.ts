// 业务实体类型定义（与后端 Pydantic schema 对齐）
// EXPORTS: Role, IUser, IPatient, IEcgRecord, IEcgRecordSummary, IWaveform,
// IShapChart, IReport, IFollowUp, IContact, ICheckIn, IRehabPlan, IPolicy,
// IFeatureMap, RiskLevel, RISK_META, FEATURE_LABELS

export type Role = 'doctor' | 'patient';

export interface IUser {
  id: number;
  username: string;
  role: Role;
  display_name: string;
  phone: string;
  is_active: boolean;
  created_at: string;
}

export interface IToken {
  access_token: string;
  token_type: string;
  role: Role;
  user_id: number;
  display_name: string;
}

export interface IPatient {
  id: number;
  user_id: number | null;
  doctor_id: number;
  name: string;
  gender: string;
  age: number | null;
  birth_date: string;
  height_cm: number | null;
  weight_kg: number | null;
  past_history: string[];
  medication: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface IPatientPayload {
  name: string;
  gender?: string;
  age?: number | null;
  birth_date?: string;
  height_cm?: number | null;
  weight_kg?: number | null;
  past_history?: string[];
  medication?: string;
  note?: string;
  user_id?: number | null;
  patient_username?: string;
}

export type RiskLevel = '低危' | '中危' | '高危' | string;

export interface IEcgRecordSummary {
  id: number;
  record_id: string;
  patient_id: number;
  file_name: string;
  risk_level: RiskLevel;
  risk_num: number;
  risk_score: number;
  total_beats: number;
  abnormal_beats: number;
  symptoms: string;
  status: string;
  created_at: string;
}

/** 12 项心电特征，键固定；后端可能多给或少给，统一按稀疏字典处理。 */
export type IFeatureMap = Record<string, number>;

export interface IEcgRecord extends IEcgRecordSummary {
  fs: number | null;
  risk_probs: number[] | null;
  features: IFeatureMap | null;
  r_peaks: number[] | null;
  abnormal_positions: number[] | null;
  cnn_status: string;
  cnn_confidence: number | null;
  shap_result: Record<string, unknown> | null;
  report_text: string;
  report_data: Record<string, unknown> | null;
}

export interface IWaveform {
  record_id: string;
  fs: number;
  signal: number[];
  r_peaks: number[];
  abnormal_positions: number[];
}

/** SHAP 四端点统一外层结构。 */
export interface IShapEnvelope {
  available: boolean;
  target_class?: number;
  target_label?: string;
  base_value?: number;
  feature_order?: string[];
  chart: Record<string, unknown>;
  message?: string;
}

export interface IReport {
  record_pk: number;
  record_id: string;
  patient_name: string;
  patient_gender: string;
  patient_age: number | null;
  file_name: string;
  risk_level: RiskLevel;
  risk_score: number;
  risk_probs: number[] | null;
  total_beats: number;
  abnormal_beats: number;
  report_text: string;
  report_data: Record<string, unknown> | null;
  has_shap: boolean;
  created_at: string;
}

export interface IFollowUp {
  id: number;
  patient_id: number;
  doctor_id: number;
  ecg_record_id: number | null;
  due_date: string | null;
  status: string;
  content: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface IContact {
  id: number;
  patient_id: number | null;
  device_key: string;
  name: string;
  relation: string;
  phone: string;
  is_primary: boolean;
  created_at: string;
}

export interface ICheckIn {
  id: number;
  patient_id: number;
  checkin_date: string;
  symptoms: string;
  symptom_tags: string[] | null;
  heart_rate: number | null;
  blood_pressure: string;
  mood: string;
  note: string;
  created_at: string;
}

export interface IRehabPlan {
  id: number;
  patient_id: number;
  ecg_record_id: number | null;
  risk_level: RiskLevel;
  exercise_type: string;
  intensity: string;
  duration_min: number;
  frequency: string;
  guidance: string;
  cautions: string;
  created_at: string;
}

export interface IPolicy {
  id: number;
  title: string;
  category: string;
  source: string;
  source_url: string;
  published_at: string | null;
  summary: string;
  content: string;
  cover_image: string;
}

/** 风险等级展示元信息（颜色为 hex，供非 CSS 场景如 Plotly / ECharts 复用）。 */
export const RISK_META: Record<string, { label: string; hex: string; tone: string }> = {
  低危: { label: '低危', hex: '#2f9e6e', tone: 'success' },
  中危: { label: '中危', hex: '#e08a12', tone: 'warning' },
  高危: { label: '高危', hex: '#d9413b', tone: 'destructive' },
};

/** 12 项特征中文名与单位，用于结果表格展示。 */
export const FEATURE_LABELS: Record<string, { label: string; unit: string }> = {
  HR: { label: '心率', unit: 'bpm' },
  PR: { label: 'PR 间期', unit: 'ms' },
  QRS: { label: 'QRS 时限', unit: 'ms' },
  QT: { label: 'QT 间期', unit: 'ms' },
  QTc: { label: '校正 QT', unit: 'ms' },
  ST_shift: { label: 'ST 偏移', unit: 'mV' },
  P_amp: { label: 'P 波振幅', unit: 'mV' },
  T_amp: { label: 'T 波振幅', unit: 'mV' },
  RR_mean: { label: 'RR 均值', unit: 'ms' },
  RR_std: { label: 'RR 标准差', unit: 'ms' },
  SDNN: { label: 'SDNN', unit: 'ms' },
  RMSSD: { label: 'RMSSD', unit: 'ms' },
};

export const FEATURE_ORDER = [
  'HR', 'PR', 'QRS', 'QT', 'QTc', 'ST_shift',
  'P_amp', 'T_amp', 'RR_mean', 'RR_std', 'SDNN', 'RMSSD',
];
