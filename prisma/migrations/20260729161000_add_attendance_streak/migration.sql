ALTER TABLE "AppSettings" ADD COLUMN "attendanceStreakTiers" JSONB NOT NULL DEFAULT '[{"months":6,"multiplier":3},{"months":3,"multiplier":2},{"months":0,"multiplier":1}]';

ALTER TABLE "Payment" ADD COLUMN "attendanceStreakMonths" INTEGER NOT NULL DEFAULT 0;
