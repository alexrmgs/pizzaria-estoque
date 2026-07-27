CREATE TABLE "DayOff" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayOff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DayOff_employeeId_idx" ON "DayOff"("employeeId");

CREATE UNIQUE INDEX "DayOff_employeeId_date_key" ON "DayOff"("employeeId", "date");

ALTER TABLE "DayOff" ADD CONSTRAINT "DayOff_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
