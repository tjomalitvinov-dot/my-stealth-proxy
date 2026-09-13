      } catch (err) {
        var errorDetails = err.toString();
        console.error(`🔌 Крах зв'язку з проксі [${proxyItem.serviceName}]: ` + errorDetails);
        
        // === АВТОМАТИЧЕСКАЯ No-Code ДЕФЕКТОВКА IP НА ЛИСТ BAD_IPs ===
        try {
          var badIpsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Bad_IPs");
          if (badIpsSheet) {
            var currentTimestamp = new Date();
            var extractedProxyIp = fetchUrl.match(/[\d\.]+:[\d]+/); // Выкусываем IP:Порт из маски запроса
            var cleanIp = extractedProxyIp ? extractedProxyIp[0] : "Unknown IP";
            var cleanReason = errorDetails.includes("402") ? "Провайдер: Нет баланса (402)" : (errorDetails.includes("403") ? "Блок Cloudflare / 403" : errorDetails);
            
            // Записываем плохой IP новой чистой строкой на лист Bad_IPs!
            badIpsSheet.appendRow([currentTimestamp, url, cleanIp, `${proxyItem.serviceName} -> ${cleanReason}`]);
            SpreadsheetApp.flush(); // Мгновенно выталкиваем изменения в таблицу
          }
        } catch (sheetLogErr) {
          console.warn("⚠️ Ошибка записи брака на лист: " + sheetLogErr.toString());
        }
        // ==========================================================
      }



const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Docker конвейер с дефектовкой IP запущен на порту ${PORT}`); });
