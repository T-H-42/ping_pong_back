import { IsNotEmpty, isNotEmpty } from "class-validator"

export class LoginDto{
	@IsNotEmpty()
	code:string
}