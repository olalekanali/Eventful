export enum UserRole {
  EVENTEE = 'eventee',
  CREATOR = 'creator',
  ADMIN = 'admin',
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum EventCategory {
  CONCERT = 'concert',
  CONFERENCE = 'conference',
  THEATER = 'theater',
  SPORTS = 'sports',
  FESTIVAL = 'festival',
  WORKSHOP = 'workshop',
  EXHIBITION = 'exhibition',
  CULTURAL = 'cultural',
  OTHER = 'other',
}

export enum TicketStatus {
  PENDING = 'pending',
  PAID = 'paid',
  USED = 'used',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum ReminderType {
  ONE_HOUR = '1_hour',
  ONE_DAY = '1_day',
  THREE_DAYS = '3_days',
  ONE_WEEK = '1_week',
  TWO_WEEKS = '2_weeks',
  ONE_MONTH = '1_month',
}

export const ReminderDurationMs: Record<ReminderType, number> = {
  [ReminderType.ONE_HOUR]: 60 * 60 * 1000,
  [ReminderType.ONE_DAY]: 24 * 60 * 60 * 1000,
  [ReminderType.THREE_DAYS]: 3 * 24 * 60 * 60 * 1000,
  [ReminderType.ONE_WEEK]: 7 * 24 * 60 * 60 * 1000,
  [ReminderType.TWO_WEEKS]: 14 * 24 * 60 * 60 * 1000,
  [ReminderType.ONE_MONTH]: 30 * 24 * 60 * 60 * 1000,
};

export const ReminderLabels: Record<ReminderType, string> = {
  [ReminderType.ONE_HOUR]: '1 hour before',
  [ReminderType.ONE_DAY]: '1 day before',
  [ReminderType.THREE_DAYS]: '3 days before',
  [ReminderType.ONE_WEEK]: '1 week before',
  [ReminderType.TWO_WEEKS]: '2 weeks before',
  [ReminderType.ONE_MONTH]: '1 month before',
};
