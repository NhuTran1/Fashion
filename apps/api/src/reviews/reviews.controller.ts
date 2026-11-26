import type { IncomingMessage } from 'node:http';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { requireJson, requireSessionCredentials } from '../auth/session-http';
import { CatalogPageQuery } from '../catalog/product-list.query';
import { hasUserRole } from '../users/user-role.policy';
import { CreateReviewDto, parseReviewResourceId } from './review.dto';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly auth: AuthService,
    private readonly reviews: ReviewsService,
  ) {}

  /** Nhận đánh giá từ Customer đã xác thực trên Android hoặc Web. */
  @Post()
  async createReview(
    @Req() request: IncomingMessage,
    @Body() input: CreateReviewDto,
  ) {
    const { token, channel } = requireSessionCredentials(request, 'write');
    const session = await this.auth.requireActiveSession(token, channel);
    if (!hasUserRole(session.user, 'CUSTOMER')) throw new ForbiddenException();
    requireJson(request);

    const orderItemId = parseReviewResourceId(input.orderItemId);
    if (orderItemId === undefined) throw new BadRequestException();
    return this.reviews.create(session.userId, orderItemId, input);
  }
}

@Controller('products/:productId/reviews')
export class PublicProductReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Liệt kê đánh giá hiển thị của một sản phẩm công khai. */
  @Get()
  listProductReviews(
    @Param('productId') productId: string,
    @Query() query: CatalogPageQuery,
  ) {
    const id = parseReviewResourceId(productId);
    if (id === undefined) throw new NotFoundException();
    return this.reviews.listPublic(id, query);
  }
}
