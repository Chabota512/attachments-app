import { createInsertSchema } from "drizzle-zod";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const organizationTypeEnum = pgEnum("organization_type", [
  "company",
  "government",
  "ngo",
  "school",
  "university",
  "professional_body",
  "recruiter",
  "community",
  "other",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "verified",
  "partially_verified",
  "unverified",
  "needs_review",
]);

export const confidenceEnum = pgEnum("confidence", ["high", "medium", "low"]);

export const locationPrecisionEnum = pgEnum("location_precision", [
  "exact",
  "street",
  "neighborhood",
  "city",
  "approximate",
  "unknown",
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "official",
  "government",
  "university",
  "professional_body",
  "job_board",
  "news",
  "directory",
  "social",
  "api",
  "other",
]);

export const sourceAccessStatusEnum = pgEnum("source_access_status", [
  "verified",
  "redirected",
  "inaccessible",
  "dead",
  "suspicious",
]);

export const opportunityTypeEnum = pgEnum("opportunity_type", [
  "job",
  "internship",
  "wil",
  "graduate_programme",
  "apprenticeship",
  "bursary",
  "volunteering",
  "training",
  "other",
]);

export const opportunityStatusEnum = pgEnum("opportunity_status", [
  "active",
  "closing_soon",
  "expired",
  "unclear",
  "unverified",
]);

export const sources = pgTable(
  "career_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    domain: text("domain"),
    sourceType: sourceTypeEnum("source_type").notNull(),
    accessStatus: sourceAccessStatusEnum("access_status").notNull().default("verified"),
    evidenceQuote: text("evidence_quote"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    urlUnique: uniqueIndex("career_sources_url_unique").on(table.url),
    domainIndex: index("career_sources_domain_idx").on(table.domain),
  }),
);

export const organizations = pgTable(
  "career_organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    legalName: text("legal_name"),
    organizationType: organizationTypeEnum("organization_type").notNull().default("company"),
    description: text("description"),
    websiteUrl: text("website_url"),
    careersUrl: text("careers_url"),
    applicationUrl: text("application_url"),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    sectors: jsonb("sectors").$type<string[]>().notNull().default([]),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("needs_review"),
    confidence: confidenceEnum("confidence").notNull().default("low"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    canonicalNameIndex: index("career_organizations_name_idx").on(table.canonicalName),
    websiteIndex: index("career_organizations_website_idx").on(table.websiteUrl),
  }),
);

export const organizationLocations = pgTable(
  "career_organization_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    label: text("label"),
    address: text("address"),
    city: text("city").notNull(),
    province: text("province"),
    country: text("country").notNull().default("Zambia"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    precision: locationPrecisionEnum("precision").notNull().default("unknown"),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  },
  (table) => ({
    organizationIndex: index("career_org_locations_org_idx").on(table.organizationId),
    cityIndex: index("career_org_locations_city_idx").on(table.city),
  }),
);

export const professions = pgTable(
  "career_professions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalTitle: text("canonical_title").notNull(),
    alternativeTitles: jsonb("alternative_titles").$type<string[]>().notNull().default([]),
    description: text("description"),
    commonTasks: jsonb("common_tasks").$type<string[]>().notNull().default([]),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    qualifications: jsonb("qualifications").$type<string[]>().notNull().default([]),
    pathways: jsonb("pathways").$type<string[]>().notNull().default([]),
    professionalBodies: jsonb("professional_bodies").$type<string[]>().notNull().default([]),
    verificationStatus: verificationStatusEnum("verification_status").notNull().default("needs_review"),
    confidence: confidenceEnum("confidence").notNull().default("low"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  },
  (table) => ({
    titleIndex: index("career_professions_title_idx").on(table.canonicalTitle),
  }),
);

export const organizationProfessions = pgTable(
  "career_organization_professions",
  {
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    professionId: uuid("profession_id").notNull().references(() => professions.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pairUnique: uniqueIndex("career_org_profession_pair_unique").on(table.organizationId, table.professionId),
  }),
);

export const opportunities = pgTable(
  "career_opportunities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    professionId: uuid("profession_id").references(() => professions.id, { onDelete: "set null" }),
    locationId: uuid("location_id").references(() => organizationLocations.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    opportunityType: opportunityTypeEnum("opportunity_type").notNull(),
    status: opportunityStatusEnum("status").notNull().default("unverified"),
    description: text("description"),
    requirements: jsonb("requirements").$type<string[]>().notNull().default([]),
    applicationMethod: text("application_method"),
    applicationUrl: text("application_url"),
    remote: boolean("remote").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    evidenceQuote: text("evidence_quote"),
    confidence: confidenceEnum("confidence").notNull().default("low"),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIndex: index("career_opportunities_org_idx").on(table.organizationId),
    statusIndex: index("career_opportunities_status_idx").on(table.status),
    deadlineIndex: index("career_opportunities_deadline_idx").on(table.deadlineAt),
  }),
);

export const publicContacts = pgTable(
  "career_public_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
    contactUrl: text("contact_url"),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  },
  (table) => ({
    organizationIndex: index("career_public_contacts_org_idx").on(table.organizationId),
  }),
);

export const verificationEvents = pgTable(
  "career_verification_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recordType: text("record_type").notNull(),
    recordId: uuid("record_id").notNull(),
    sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
    status: verificationStatusEnum("status").notNull(),
    evidenceQuote: text("evidence_quote"),
    notes: text("notes"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    recordIndex: index("career_verification_record_idx").on(table.recordType, table.recordId),
    checkedAtIndex: index("career_verification_checked_at_idx").on(table.checkedAt),
  }),
);

export const insertSourceSchema = createInsertSchema(sources);
export const insertOrganizationSchema = createInsertSchema(organizations);
export const insertOrganizationLocationSchema = createInsertSchema(organizationLocations);
export const insertProfessionSchema = createInsertSchema(professions);
export const insertOpportunitySchema = createInsertSchema(opportunities);
export const insertPublicContactSchema = createInsertSchema(publicContacts);
export const insertVerificationEventSchema = createInsertSchema(verificationEvents);

export type Source = typeof sources.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationLocation = typeof organizationLocations.$inferSelect;
export type Profession = typeof professions.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type PublicContact = typeof publicContacts.$inferSelect;
export type VerificationEvent = typeof verificationEvents.$inferSelect;

export type InsertSource = z.infer<typeof insertSourceSchema>;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertOrganizationLocation = z.infer<typeof insertOrganizationLocationSchema>;
export type InsertProfession = z.infer<typeof insertProfessionSchema>;
export type InsertOpportunity = z.infer<typeof insertOpportunitySchema>;
export type InsertPublicContact = z.infer<typeof insertPublicContactSchema>;
export type InsertVerificationEvent = z.infer<typeof insertVerificationEventSchema>;
