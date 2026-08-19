-- Separa o adiantamento quinzenal (40%) do vale-comida — mesmo modelo, mas
-- com identidade própria pra não aparecer misturado nas telas de Vales.
CREATE TYPE "AdvanceKind" AS ENUM ('VALE', 'ADIANTAMENTO');

ALTER TABLE "Advance" ADD COLUMN "kind" "AdvanceKind" NOT NULL DEFAULT 'VALE';

UPDATE "Advance" SET "kind" = 'ADIANTAMENTO' WHERE "description" = 'Adiantamento quinzenal (40%)';
