import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { DocumentsRouter } from "./documents.router";
import { DocumentsService } from "./documents.service";

@Module({
	imports: [TrpcModule],
	providers: [DocumentsService, DocumentsRouter],
	exports: [DocumentsService],
})
export class DocumentsModule {}
