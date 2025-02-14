# Eclipse AIO

## Overview

**Eclipse Turbo Tap** is a TypeScript-based project designed to automate interaction with the Turbo Tap application. The software is intended to simplify only, but in no way a complete replacement. 

---

## Features

- **Mint Domain**. The application is capable of obtaining the domain on its own.
- **Deposit clicks**. Deposit funds to the account from which clicks will be made.
- **Get statics(points)**. Get statistics such as rank, points, clicks.
- **Clicks**. Sending clicks to the blockchain.

## Installation
### Steps

1. Clone the repository:
```bash
git clone https://github.com/ssq0-0/Eclipse-Turbo-Tap.git
cd Eclipse-Turbo-Tap
npm i 
npm run build
```
2. Run the application:
- **Before you start the programme from scratch, including the domain mint you need to go to the TurboTap page and manually connect social networks**
- **Setup wallets files(svmWallets.txt && proxy.txt for first try and tap_wallets.json for other)**
- **Setup user_config.json(time and count actions)**

```bash
npm run start
```
**IMPORTANT! When you start mint domain and after it is installed, the programme will install your account in leaderboard (without it the programme will not work), but with 90% probability you will get an error - this is normal6 the account will still be installed and you do not need to restart the programme several times, this is a problem on the turbo tap application side.**

### SVM Wallets (`svmWallets.txt`)

Put SVM wallets here to use the Relay module. Otherwise it can be left empty. Note that the order is important for mapping to the evm_walles.txt file

### Turbo Tap Wallets (`tap_wallets.json`)

Before running the Click module, you need to go to your browser, open the developer console and do the following:
```bash
allow pasting
localStorage.getItem('wallet')
```
An array of numbers will be displayed in the console, which should be inserted into the tap_wallets.json file
---
### Proxy (`proxy.txt`)

This section defines the proxy used by the program. Each proxy is described by the following fields:

- **`http://user:pass@ip:port`**:
---
### Config (`user_config.json`)

Set up the configuration. 
Full configuration instructions can be found in the same file, with detailed comments on each parameter. Initially, the basic configuration with average values is also specified by default

**IMPORTANT!** The app is only for introductory purposes as an example of how to interact with blockchain and apps. The author is not responsible for your game accounts. By launching the app, you agree to this condition.

### For additional assistance or troubleshooting, refer to the official documentation or reach out via [support channel](https://t.me/cheifssq).

---

# Eclipse AIO

## Обзор

**Eclipse Turbo Tap** - это проект на основе TypeScript, предназначенный для автоматизации взаимодействия с приложением Turbo Tap. Программа предназначена только для упрощения, но ни в коем случае не для полной замены. 

---

## Features

- **Мятный домен**. Приложение способно самостоятельно получить домен.
- **Депозит кликов**. Пополнение счета, с которого будут производиться клики.
- **Получить статистику (очки)**. Получить статистику, такую как ранг, очки, клики.
- **Клики**. Отправка кликов в блокчейн.

## Установка
### Шаги

1. Клонируйте репозиторий:
```bash
git clone https://github.com/ssq0-0/Eclipse-Turbo-Tap.git
cd Eclipse-Turbo-Tap
npm i 
npm run build
```
2. Запустите приложение:
- **Перед запуском программы с нуля(mint домена), необходимо перейти на страницу TurboTap и вручную подключить социальные сети**.
- **Заполните файлы кошельков (svmWallets.txt && proxy.txt для первой попытки и tap_wallets.json для остальных)**
- **Заполните файл user_config.json (время и конфигурация действий)**

```bash
npm run start
```
**ВАЖНО! При запуске mint domain и после его установки программа установит ваш аккаунт в leaderboard (без него программа не будет работать), но с вероятностью 90% вы получите ошибку - это нормально, аккаунт все равно будет установлен и вам не нужно будет перезапускать программу несколько раз, это проблема на стороне приложения turbo tap.**.

### Кошельки SVM (`svmWallets.txt`)

Поместите сюда кошельки SVM.

### Turbo Tap Wallets (`tap_wallets.json`)

Перед запуском модуля Click необходимо перейти в браузер, открыть консоль разработчика и выполнить следующие действия:
```bash
allow pasting
localStorage.getItem('wallet')
```
В консоли появится массив чисел, который необходимо вставить в файл tap_wallets.json

- Пример заполненного файла:
```bash
[
    [123,456,789..., 0],
    [321,456,789..., 0],
    [555,456,789..., 0],
]
```
---
### Прокси (`proxy.txt`)

В этом разделе определяются прокси, используемые программой. Каждый прокси описывается следующими полями:

- **`http://user:pass@ip:port`**:
---
### Конфигурация (`user_config.json`)

Настройте конфигурацию. 
Полные инструкции по настройке можно найти в этом же файле, с подробными комментариями по каждому параметру. По умолчанию также задана базовая конфигурация со средними значениями

**ВАЖНО!** Приложение предназначено только для ознакомительных целей в качестве примера взаимодействия с блокчейном и приложениями. Автор не несет ответственности за ваши игровые счета. Запуская приложение, вы соглашаетесь с этим условием.

### Для получения дополнительной помощи или устранения неполадок обратитесь к официальной документации или свяжитесь с нами через [канал поддержки](https://t.me/cheifssq).