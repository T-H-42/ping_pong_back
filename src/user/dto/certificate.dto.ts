import { IsNumber, MaxLength } from "class-validator"

export class CertificateDto {
	username: string
	@IsNumber()
	@MaxLength(6)
	two_factor_authentication_code:number
}