import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminWebGuard } from './admin-web.guard';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { LocalImageStorage } from './image-storage';
import {
  AdminProductImagesController,
  PublicProductImagesController,
} from './product-images.controller';
import { ProductImagesService } from './product-images.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    CatalogController,
    AdminCatalogController,
    InventoryController,
    AdminProductImagesController,
    PublicProductImagesController,
  ],
  providers: [
    CatalogService,
    AdminCatalogService,
    AdminWebGuard,
    InventoryService,
    LocalImageStorage,
    ProductImagesService,
  ],
  exports: [AdminWebGuard, InventoryService],
})
export class CatalogModule {}
