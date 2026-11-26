import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { DatabaseModule } from '../database/database.module';
import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutService } from './checkout.service';
import { OrderSnapshotService } from './order-snapshot.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, CatalogModule, DatabaseModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [CheckoutService, OrderSnapshotService, OrdersService],
})
export class OrdersModule {}
