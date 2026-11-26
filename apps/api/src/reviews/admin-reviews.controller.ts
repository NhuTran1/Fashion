import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { requireJson } from '../auth/session-http';
import {
  AdminWebGuard,
  type AdminWebRequest,
} from '../catalog/admin-web.guard';
import {
  AdminReviewPageQuery,
  parseReviewResourceId,
  ReviewModerationDto,
} from './review.dto';
import { ReviewsService } from './reviews.service';

@Controller('admin/reviews')
@UseGuards(AdminWebGuard)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Trả danh sách review quản trị theo trang và trạng thái. */
  @Get()
  @Header('Cache-Control', 'no-store')
  listAdminReviews(@Query() query: AdminReviewPageQuery) {
    return this.reviews.listAdmin(query);
  }

  /** Ẩn hoặc hiện review bằng phiên Admin Web đã xác thực. */
  @Patch(':reviewId/visibility')
  @Header('Cache-Control', 'no-store')
  moderateReview(
    @Req() request: AdminWebRequest,
    @Param('reviewId') reviewId: string,
    @Body() input: ReviewModerationDto,
  ) {
    requireJson(request);
    const id = parseReviewResourceId(reviewId);
    if (id === undefined) throw new NotFoundException();
    return this.reviews.moderate(id, input.status, request.adminUserId);
  }
}
