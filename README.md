# WebsocketTest

## Backend Package

### 환경에따라 sudo 추가하시길 (npm install --save가 안되는 경우, yarn add로 추가하시면 됩니다.)

- npm install pg typeorm @nestjs/typeorm --save     //postgres 및 typeorm
- npm install @nestjs/jwt @nestjs/passport passport passport-jwt --save    //jwt service를 위한 토큰 
- npm install express --save // response 객체 등
- nest g gateway _name
- nest g socket.io
- npm install @nestjs/websockets --save
- yarn add config
- npm install jsonwebtoken --save 


---

### sendmail 관련 패키지

npm install --save @nestjs-modules/mailer nodemailer
npm install --save-dev @types/nodemailer

### pick one template adapter and install
npm install --save handlebars
### or
npm install --save pug
### or
npm install --save ejs
