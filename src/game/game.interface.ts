
interface IPaddleMove {
	roomName: string;
	isOwner: boolean;
	paddleStatus: number;
}

// game setting 정보
interface ISettingInformation {
	score: number;
	speed: number;
	roomName: string;
}