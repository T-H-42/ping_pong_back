import { IsString, Matches, MaxLength, MinLength } from "class-validator"

export class NicknameDto{
	@IsString({
		message: 'nickname은 문자열이여야 합니다.'
	})
	@MinLength(2,{
		message: 'nickname은 2글자 이상이여야 합니다.'
	})
	@MaxLength(10, {
		message: 'nickname은 10글자 이하여야 합니다.'
	})
	@Matches(/^[a-zA-Z0-9]*$/, {
		message: 'nickname은 알파벳이랑 숫자만 쓰세요'
	})
	nickname:string

}