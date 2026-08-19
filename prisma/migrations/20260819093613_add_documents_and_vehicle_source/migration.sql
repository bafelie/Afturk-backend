-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "ghanaCardPhoto" TEXT,
ADD COLUMN     "isStudent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "selfiePhoto" TEXT,
ADD COLUMN     "studentIdPhoto" TEXT,
ADD COLUMN     "vehicleSource" TEXT;

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "vehicleSource" TEXT;
