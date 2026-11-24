export type CableCategory =
  | "國際焦點"
  | "財經科技"
  | "資安公告"
  | "自訂爬文"
  | "API 變動"
  | "Reddit 熱議"
  | "GitHub 釋出";

export type RiskLevel = "high" | "medium" | "low";

export type SourceSector = "official" | "community";

export type RegionScope = "全球" | "北美" | "歐洲" | "亞太" | "台灣";

export type CountryCode =
  | "TW"
  | "US"
  | "GB"
  | "JP"
  | "DE"
  | "KR"
  | "SG"
  | "AU"
  | "GLOBAL";

export interface CountryOption {
  code: CountryCode;
  name: string;
  region: RegionScope;
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "TW", name: "台灣", region: "亞太" },
  { code: "US", name: "美國", region: "北美" },
  { code: "GB", name: "英國", region: "歐洲" },
  { code: "JP", name: "日本", region: "亞太" },
  { code: "DE", name: "德國", region: "歐洲" },
  { code: "KR", name: "韓國", region: "亞太" },
  { code: "SG", name: "新加坡", region: "亞太" },
  { code: "AU", name: "澳洲", region: "亞太" },
  { code: "GLOBAL", name: "全球跨國", region: "全球" },
];

export interface CommentItem {
  id: string;
  author: string;
  role: string;
  createdAt: string;
  content: string;
}

export interface DiffBlock {
  language: string;
  beforeLabel: string;
  afterLabel: string;
  before: string;
  after: string;
}

export interface BlogDigest {
  headline: string;
  lead: string;
  keyPoints: string[];
  markers: string[];
  takeAway: string;
  markdown: string;
  generatedAt: string;
}

export type HighlightColor = "yellow" | "green" | "blue" | "pink";

export interface ReaderHighlight {
  id: string;
  paragraphIndex: number;
  text: string;
  color: HighlightColor;
  note?: string;
  createdAt: string;
}

export interface ReaderStrokePoint {
  x: number;
  y: number;
}

export interface ReaderStroke {
  id: string;
  tool: "pen" | "highlighter";
  color: string;
  width: number;
  points: ReaderStrokePoint[];
}

export interface FullArticleBlock {
  type: "heading" | "paragraph" | "quote";
  text: string;
  translatedText?: string;
}

export interface CableEntry {
  id: string;
  title: string;
  originalTitle?: string;
  category: CableCategory;
  riskLevel: RiskLevel;
  sourceSector?: SourceSector;
  countryCode: CountryCode;
  countryName: string;
  region: RegionScope;
  originalLanguage: string;
  sourceName: string;
  sourceId: string;
  sourceIcon: string;
  bannerImage: string;
  version: string;
  publishedAt: string;
  url: string;
  heatScore: number;
  commentCount: number;
  tags: string[];
  aiSummary: string;
  keyChanges: string[];
  impactScope: string;
  migrationSteps: string[];
  aiEnriched?: boolean;
  blogDigest?: BlogDigest | null;
  bookmarked?: boolean;
  bookmarkedAt?: string | null;
  sharedToBlog?: boolean;
  sharedToBlogAt?: string | null;
  fullArticleBlocks?: FullArticleBlock[];
  fullArticleFetchedAt?: string | null;
  fullArticleSourceMode?: "live_full_article" | "rss_expanded_fallback";
  readerHighlights?: ReaderHighlight[];
  readerStrokes?: ReaderStroke[];
  diff: DiffBlock | null;
  comments: CommentItem[];
}

export interface DatabasePayload {
  schemaVersion: string;
  lastUpdated: string;
  totalRecords: number;
  entries: CableEntry[];
}

export interface SourceItem {
  id: string;
  name: string;
  category: CableCategory;
  sourceSector?: SourceSector;
  countryCode: CountryCode;
  countryName: string;
  region: RegionScope;
  type: string;
  endpoint: string;
  enabled: boolean;
  lastCheckedAt: string;
  lastStatus: string;
  itemsCaptured: number;
}

export interface ScheduleShift {
  id: string;
  name: string;
  cron: string;
  timeLabel: string;
  countries: CountryCode[];
  enabled: boolean;
  autoPushRss: boolean;
  lastExecutedAt: string | null;
}

export interface SyncLogItem {
  id: string;
  timestamp: string;
  trigger: string;
  status: string;
  sourcesChecked: number;
  newEntries: number;
  durationSeconds: number;
  commitSha: string;
  message: string;
}

export interface SourcesPayload {
  pipeline: {
    autoEnabled: boolean;
    intervalMinutes: number;
    scheduleCron: string;
    scheduleLabel: string;
    aiModel: string;
    targetLanguage: string;
    autoCommit: boolean;
    autoPushEnabled: boolean;
    lastRunAt: string;
    nextRunAt: string;
    lastRunStatus: string;
    shifts: ScheduleShift[];
  };
  sources: SourceItem[];
  syncLogs: SyncLogItem[];
}

export type N8nTemplateFormat = "blog_markdown" | "json_digest" | "html_card" | "newsletter";

export interface N8nWebhookConfig {
  id: string;
  name: string;
  webhookUrl: string;
  triggerMode: "all_new" | "high_risk" | "manual";
  templateFormat: N8nTemplateFormat;
  sectorFilter: "all" | SourceSector;
  countries: Array<"ALL" | CountryCode>;
  enabled: boolean;
  createdAt: string;
  lastDispatchedAt: string | null;
  lastStatusCode: number | null;
}

export interface N8nDispatchLog {
  id: string;
  timestamp: string;
  webhookName: string;
  webhookUrl: string;
  templateFormat: N8nTemplateFormat;
  entryCount: number;
  entryTitle: string;
  statusCode: number | null;
  ok: boolean;
  message: string;
}

export interface N8nPayload {
  lastUpdated: string;
  webhooks: N8nWebhookConfig[];
  dispatchLogs: N8nDispatchLog[];
}

export type BlogLayoutTemplate = "minimal" | "editorial" | "cards";
export type CreatorPlatform = "github" | "devto" | "rss";

export interface CreatorArticlePreview {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  coverImage?: string;
}

export interface RealCreatorProfile {
  id: string;
  platform: CreatorPlatform;
  handle: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  location: string;
  company: string;
  profileUrl: string;
  websiteUrl: string;
  rssUrl: string;
  followers: number | null;
  publicRepos: number | null;
  tags: string[];
  articles: CreatorArticlePreview[];
  fetchedAt: string;
}

export interface ReferencedProfile extends RealCreatorProfile {
  referenceNote: string;
  autoSubscribedSourceId?: string | null;
  importedEntryIds: string[];
  referencedAt: string;
}

export interface FollowedProfile extends RealCreatorProfile {
  followedAt: string;
}

export type ProfileActivityKind = "bookmark" | "highlight" | "blog_post";

export interface ProfileActivityItem {
  id: string;
  kind: ProfileActivityKind;
  actorId: string;
  actorName: string;
  actorHandle: string;
  actorAvatarUrl: string;
  platform: CreatorPlatform | "cables";
  title: string;
  excerpt: string;
  url: string;
  internalPostId?: string;
  internalBlogId?: string;
  tags: string[];
  createdAt: string;
  metaLabel?: string;
}

export interface DeveloperActivityWallPayload {
  profile: RealCreatorProfile;
  activities: ProfileActivityItem[];
  stats: {
    bookmarks: number;
    highlights: number;
    blogPosts: number;
  };
}

export interface BlogProfileConfig {
  slug: string;
  blogTitle: string;
  tagline: string;
  ownerName: string;
  ownerBio: string;
  template: BlogLayoutTemplate;
  autoImportEnabled: boolean;
  autoImportCountries: Array<"ALL" | CountryCode>;
  autoImportCategories: CableCategory[];
  importedEntryIds: string[];
  referencedProfiles: ReferencedProfile[];
  followedProfiles?: FollowedProfile[];
  ownerFollowed?: boolean;
  ownerFollowersCount?: number;
  updatedAt: string;
}



