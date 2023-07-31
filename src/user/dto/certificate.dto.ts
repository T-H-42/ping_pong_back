import { IsNumber } from "class-validator"

export class CertificateDto {
	username: string
	@IsNumber()
	two_factor_authentication_code:number
}