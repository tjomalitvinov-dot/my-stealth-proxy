// Перенаправляем выполнение на скрытый код из переменных окружения
if (process.env.SERVER_CODE) { eval(process.env.SERVER_CODE); }
else { console.error("Критическая ошибка: SERVER_CODE не найден в настройках Render!"); }
