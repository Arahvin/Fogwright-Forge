@echo off
title Fogwright Forge
cd /d "%~dp0"
where py >nul 2>nul && (py -3 serve.py & goto :end)
where python >nul 2>nul && (python serve.py & goto :end)
echo Nao encontrei o Python. Instala-o em https://www.python.org/downloads/ (marca "Add python.exe to PATH").
:end
pause
