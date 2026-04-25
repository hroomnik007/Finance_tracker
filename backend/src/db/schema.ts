import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  integer,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  name: varchar("name", { length: 100 }).notNull(),
  googleId: varchar("google_id", { length: 255 }),
  emailVerified: boolean("email_verified").default(false).notNull(),
  verificationToken: varchar("verification_token", { length: 255 }),
  resetToken: varchar("reset_token", { length: 255 }),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  avatarUrl: text("avatar_url"),
  role: varchar("role", { length: 20 }).default("user").notNull(),
  weeklyEmailEnabled: boolean("weekly_email_enabled").default(false).notNull(),
  monthlyEmailEnabled: boolean("monthly_email_enabled").default(false).notNull(),
  onboardingComplete: boolean("onboarding_complete").default(false).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastActivityDate: date("last_activity_date"),
  badges: text("badges").array().default(sql`ARRAY[]::text[]`).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  pinHash: varchar("pin_hash", { length: 255 }),
  defaultPage: varchar("default_page", { length: 50 }).default("dashboard"),
  currencyFormat: varchar("currency_format", { length: 10 }).default("sk"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 10 }).notNull(),
    color: varchar("color", { length: 7 }),
    icon: varchar("icon", { length: 50 }),
    isDefault: boolean("is_default").default(false).notNull(),
    budgetLimit: numeric("budget_limit"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [check("categories_type_check", sql`${t.type} IN ('income', 'expense')`)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 10 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: varchar("description", { length: 500 }),
    date: date("date").notNull(),
    isFixed: boolean("is_fixed").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [check("transactions_type_check", sql`${t.type} IN ('income', 'expense')`)]
);

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  deviceType: varchar("device_type", { length: 32 }),
  backedUp: boolean("backed_up").default(false).notNull(),
  name: varchar("name", { length: 100 }).default("Biometrický kľúč").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sharedReports = pgTable("shared_reports", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  data: text("data").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type SharedReport = typeof sharedReports.$inferSelect;
export type WebAuthnCredential = typeof webauthnCredentials.$inferSelect;
export type NewWebAuthnCredential = typeof webauthnCredentials.$inferInsert;
