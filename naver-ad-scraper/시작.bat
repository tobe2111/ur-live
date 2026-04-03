@echo off
chcp 65001 > nul
echo 스크래퍼 시작 중...
cd /d "%~dp0"
npm install
start http://localhost:3456
npm start
pause
