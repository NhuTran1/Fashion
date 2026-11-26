import { IsIn, IsOptional } from 'class-validator';
import { CatalogPageQuery } from '../catalog/product-list.query';

const ACCOUNT_STATUSES = ['ACTIVE', 'DISABLED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export class AdminUserPageQuery extends CatalogPageQuery {
  @IsOptional()
  @IsIn(ACCOUNT_STATUSES)
  status?: AccountStatus;
}

export class AccountStatusDto {
  @IsIn(ACCOUNT_STATUSES)
  status!: AccountStatus;
}
