import { HttpException } from '@nestjs/common';

// Lỗi nghiệp vụ có mã và thông báo công khai đã được chọn ở server.
export class ApiHttpException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    publicMessage: string,
  ) {
    super(publicMessage, status);
  }
}
