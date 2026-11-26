import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { CatalogModule } from './catalog/catalog.module';
import { OrdersModule } from './orders/orders.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AdminUsersModule } from './users/admin-users.module';

// Module gốc của NestJS, đăng ký controller để framework nhận diện route.
@Module({
  imports: [
    AuthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    ReviewsModule,
    AdminUsersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
