import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

// --- Admin Users ---

export const adminUsers = sqliteTable(
  "AdminUser",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    passwordHash: text("passwordHash").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("admin"), // 'super_admin' | 'admin'
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [uniqueIndex("AdminUser_email_key").on(t.email)]
);

export const adminInvites = sqliteTable("AdminInvite", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdBy: text("createdBy")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  used: integer("used", { mode: "boolean" }).notNull().default(false),
  expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --- Events ---

export const events = sqliteTable(
  "Event",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    adminUserId: text("adminUserId").references(() => adminUsers.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    date: text("date").notNull(), // YYYY-MM-DD
    location: text("location").notNull().default(""),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updatedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("Event_adminUserId_idx").on(t.adminUserId)]
);

export const timeSlots = sqliteTable(
  "TimeSlot",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    eventId: text("eventId")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    title: text("title"), // optional title for the time slot
    startTime: text("startTime").notNull(), // HH:mm
    endTime: text("endTime").notNull(), // HH:mm
    capacity: integer("capacity").notNull(),
    sortOrder: integer("sortOrder").notNull().default(0),
  },
  (t) => [index("TimeSlot_eventId_idx").on(t.eventId)]
);

export const reservations = sqliteTable(
  "Reservation",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    timeSlotId: text("timeSlotId")
      .notNull()
      .references(() => timeSlots.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    partySize: integer("partySize").notNull().default(1),
    additionalNames: text("additionalNames"),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("Reservation_timeSlotId_email_key").on(t.timeSlotId, t.email),
    index("Reservation_timeSlotId_idx").on(t.timeSlotId),
  ]
);

// --- Relations ---

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  events: many(events),
  invites: many(adminInvites),
}));

export const adminInvitesRelations = relations(adminInvites, ({ one }) => ({
  creator: one(adminUsers, {
    fields: [adminInvites.createdBy],
    references: [adminUsers.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  adminUser: one(adminUsers, {
    fields: [events.adminUserId],
    references: [adminUsers.id],
  }),
  timeSlots: many(timeSlots),
}));

export const timeSlotsRelations = relations(timeSlots, ({ one, many }) => ({
  event: one(events, {
    fields: [timeSlots.eventId],
    references: [events.id],
  }),
  reservations: many(reservations),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  timeSlot: one(timeSlots, {
    fields: [reservations.timeSlotId],
    references: [timeSlots.id],
  }),
}));

export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminInvite = typeof adminInvites.$inferSelect;
export type Event = typeof events.$inferSelect;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
