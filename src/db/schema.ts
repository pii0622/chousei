import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";

export const events = sqliteTable("Event", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  date: text("date").notNull(), // YYYY-MM-DD
  location: text("location").notNull().default(""),
  createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updatedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const timeSlots = sqliteTable(
  "TimeSlot",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    eventId: text("eventId")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
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
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    uniqueIndex("Reservation_timeSlotId_email_key").on(t.timeSlotId, t.email),
    index("Reservation_timeSlotId_idx").on(t.timeSlotId),
  ]
);

// Relations
export const eventsRelations = relations(events, ({ many }) => ({
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

export type Event = typeof events.$inferSelect;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
