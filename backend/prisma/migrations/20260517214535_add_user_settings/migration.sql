-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "appearance" TEXT NOT NULL DEFAULT 'system',
    "wallpaper" TEXT,
    "aiTheme" TEXT,
    "weatherCity" TEXT,
    "weatherUnits" TEXT NOT NULL DEFAULT 'metric',
    "homeGoals" TEXT,
    "pinHash" TEXT,
    "canvasLayout" TEXT,
    "extraJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);
