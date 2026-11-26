import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DatabaseModule } from '../database/database.module';
import { AdminReviewsController } from './admin-reviews.controller';
import {
  PublicProductReviewsController,
  ReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [AuthModule, CatalogModule, DatabaseModule],
  controllers: [
    ReviewsController,
    PublicProductReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService],
})
export class ReviewsModule {}
