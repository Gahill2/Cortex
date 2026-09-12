-- CreateTable
CREATE TABLE "NutritionEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL,
    "originalDescription" TEXT NOT NULL,
    "normalizedDescription" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "proteinG" DECIMAL(8,2) NOT NULL,
    "carbsG" DECIMAL(8,2) NOT NULL,
    "fatG" DECIMAL(8,2) NOT NULL,
    "fiberG" DECIMAL(8,2),
    "sugarG" DECIMAL(8,2),
    "sodiumMg" INTEGER,
    "confidence" TEXT NOT NULL,
    "assumptions" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NutritionEntry_userId_consumedAt_idx" ON "NutritionEntry"("userId", "consumedAt");
