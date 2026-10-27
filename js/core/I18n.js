/**
 * I18n.js — Đa ngôn ngữ Việt / Anh (chỉ đổi chữ hiển thị, KHÔNG đụng tới dữ liệu gửi qua mạng).
 *
 * Cách dùng
 *   • HTML tĩnh:   <span data-i18n="menu.play">Chiến Đấu Ngay</span>      (chữ trong HTML = tiếng Việt gốc)
 *                  <button data-i18n-attr="title:menu.settings;aria-label:menu.settings">
 *   • JS động:     I18n.t('key', { name })           → chuỗi theo ngôn ngữ hiện tại
 *                  I18n.bind(el, 'key', { n })       → gắn khoá vào phần tử: tự dịch lại khi đổi ngôn ngữ
 *   • Dữ liệu:     I18n.charName(c) / charTitle(c) / charDesc(c) / stageName(s)
 *
 * Bảng chuỗi S: 'khoá': [tiếng Việt | null, tiếng Anh]. null = lấy nguyên văn từ HTML (đã có sẵn trong trang).
 * Tham số {x} được thoát HTML khi chèn vào innerHTML nên an toàn với chuỗi do người dùng/ mạng đưa vào.
 */

const LS_LANG = 'chosua_lang';
const LANGS = ['vi', 'en'];

/* eslint-disable max-len */
const S = {
  // ── Chung ──────────────────────────────────────────
  'boot.text': [null, 'Getting the barking arena ready... 🐕'],
  'common.back': [null, 'Back'],
  'common.settings': ['Cài đặt', 'Settings'],
  'common.rankings': ['Bảng xếp hạng', 'Rankings'],
  'common.reset': ['Xoá toàn bộ dữ liệu', 'Erase all data'],

  // ── Nút đổi ngôn ngữ / giao diện ──────────────────
  'tg.lang': ['Ngôn ngữ: Tiếng Việt — bấm để chuyển sang English', 'Language: English — tap to switch to Tiếng Việt'],
  'tg.toNight': ['Chuyển sang chế độ tối (ban đêm)', 'Switch to dark mode (night)'],
  'tg.toDay': ['Chuyển sang chế độ sáng (hoàng hôn)', 'Switch to light mode (sunset)'],

  'pop.ok': ['Đã hiểu', 'Got it'],
  'pop.t.err': ['Thông báo', 'Notice'],
  'pop.t.lost': ['Mất kết nối', 'Connection lost'],
  'pop.t.left': ['Đối thủ đã rời', 'Opponent left'],
  'pop.t.ver': ['Khác phiên bản game', 'Different game versions'],
  'pop.t.cant': ['Không vào được phòng', 'Couldn’t connect'],
  'pop.t.win': ['Bạn thắng!', 'You win!'],
  'pop.t.link': ['Liên kết mời', 'Invite link'],
  'on.joined': ['🐶 Đối thủ đã vào phòng!', '🐶 Your opponent joined the room!'],
  'b.weak': ['📶 Mạng yếu — trận có thể giật, hãy lại gần wifi hoặc tắt app khác.', '📶 Weak connection — the match may lag. Move closer to wifi or close other apps.'],
  'pop.t.app': ['Đang dùng trình duyệt trong app', 'In-app browser detected'],
  'snd.tap': ['🔈 Chạm màn hình để bật lại âm thanh', '🔈 Tap the screen to turn the sound back on'],

  'asset.applying': ['Đang áp dụng ảnh mới…', 'Applying new images…'],
  'asset.afterMatch': ['Có ảnh mới — sẽ áp dụng sau trận', 'New images found — they’ll apply after the match'],
  'asset.updating': ['Có ảnh mới trong assets — đang cập nhật…', 'New images in assets — updating…'],

  // ── Menu ───────────────────────────────────────────
  'menu.badge': [null, '🐾 BARK IT OUT · LOSE THE STRESS 🐾'],
  'menu.logoAria': [null, 'Gaune – Gâu Gâu – bark it out, lose the stress'],
  'menu.sub': [null, '⚡ BARK LOUDER · PUSH HARDER! ⚡'],
  'menu.play.tag': [null, 'MAIN CAMPAIGN'],
  'menu.play.desc': [null, 'Fight Now ▸'],
  'menu.online.tag': [null, 'FRIENDS · ONLINE'],
  'menu.online.desc': [null, '2-Player Online ▸'],
  'menu.pick.tag': [null, 'COLLECTION'],
  'menu.pick.desc': [null, 'Pick Your Warrior ▸'],

  // ── Chọn nhân vật ──────────────────────────────────
  'sel.title': [null, 'Choose your warrior'],
  'sel.none': ['Chọn nhân vật', 'Pick a character'],
  'sel.stage': [null, 'Stage'],
  'sel.start': [null, 'Start battle!'],
  'sel.random': ['Ngẫu nhiên', 'Random'],
  'tier.title': [null, 'Bot level'],
  'tier.chip': ['Cấp {n}', 'Lv {n}'],
  'tier.1': ['Tập sự', 'Rookie'],
  'tier.2': ['Thường', 'Normal'],
  'tier.3': ['Khó', 'Hard'],
  'tier.4': ['Siêu khó', 'Expert'],
  'tier.5': ['Boss', 'Boss'],
  'tier.hintNext': ['Thắng {w}/{need} trận ở cấp này để mở cấp {next} (+{bonus} GP). Thắng bot: GP ×{mult}', 'Win {w}/{need} matches at this level to unlock level {next} (+{bonus} GP). Bot win: GP ×{mult}'],
  'tier.hintLower': ['Đang luyện cấp thấp hơn: chỉ thắng ở cấp {max} mới tính tiến độ mở khoá. Thắng bot: GP ×{mult}', 'Practising a lower level: only wins at level {max} count toward unlocking. Bot win: GP ×{mult}'],
  'tier.hintMax': ['Cấp tối đa! Thắng bot: GP ×{mult}', 'Max level! Bot win: GP ×{mult}'],
  'tier.locked': ['Cấp {n} đang khoá: thắng {need} trận ở cấp {max} để mở', 'Level {n} is locked: win {need} matches at level {max} to unlock'],
  'tier.up': ['🎉 Mở khoá cấp {n} — {name}! +{wp} GP', '🎉 Level {n} unlocked — {name}! +{wp} GP'],
  'tier.prog': ['Cấp {n} {name}: thắng {w}/{need} để lên cấp {next}', 'Level {n} {name}: {w}/{need} wins to reach level {next}'],
  'tier.progLower': ['Cấp {n} {name} (luyện tập)', 'Level {n} {name} (practice)'],
  'tier.progMax': ['Cấp {n} {name} — cấp tối đa', 'Level {n} {name} — max level'],
  'sel.picked': ['✓ Chọn', '✓ Picked'],
  'sel.statPowerS': ['Mạnh', 'Power'],
  'sel.statSpeedS': ['Nhanh', 'Speed'],
  'sel.statComboS': ['Combo', 'Combo'],
  'sel.statPower': ['Sức Mạnh', 'Power'],
  'sel.statSpeed': ['Tốc Độ', 'Speed'],
  'sel.statCombo': ['Combo', 'Combo'],
  'sel.needWp': ['Cần {cost} GP! Bạn có {wp} GP.', 'You need {cost} GP! You have {wp} GP.'],
  'sel.confirmStage': ['Mở khóa bối cảnh "{name}" tốn {cost} GP?', 'Unlock the stage "{name}" for {cost} GP?'],
  'sel.confirmChar': ['Mở khóa {name} tốn {cost} GP?', 'Unlock {name} for {cost} GP?'],
  'sel.unlocked': ['✅ Đã mở khóa {name}!', '✅ {name} unlocked!'],
  'sel.tempo': ['⚡ Sủa liền nhau (&lt;0,6s): <b>{v}</b>', '⚡ Rapid barks (&lt;0.6s): <b>{v}</b>'],
  'sel.tempoYes': ['+{n}% lực', '+{n}% power'],
  'sel.tempoNo': ['không thưởng', 'no bonus'],
  'sel.aiRhythm': ['⏱ Nhịp sủa AI: <b>{ms}ms</b> <small>(mic và nút chạm không bị chặn)</small>', '⏱ AI bark rhythm: <b>{ms}ms</b> <small>(mic and tap button are never limited)</small>'],
  'sel.window': ['🔥 Giữ combo: <b>{s}s</b> · mỗi bậc <b>+{step}</b>', '🔥 Combo window: <b>{s}s</b> · per step <b>+{step}</b>'],

  // ── Trận đấu ───────────────────────────────────────
  'b.hint': [null, 'Bark loud and often to push the power bar toward your opponent'],
  'b.hintSub': [null, ''],
  'b.barks': [null, 'BARKS'],
  'b.tap': [null, 'BARK!'],
  'b.tapAria': [null, 'Tap to bark'],
  'b.micAria': [null, 'Mic status — tap to retry'],
  'b.exit': [null, 'Leave match'],
  'b.you': ['← BẠN · {name}', '← YOU · {name}'],
  'b.youSolo': ['← {name}', '← {name}'],
  'b.opp': ['{name} · ĐỐI THỦ →', '{name} · OPPONENT →'],
  'b.ai': ['{name} (AI) →', '{name} (AI) →'],
  'b.go': ['SỦA ĐI!', 'BARK!'],
  'b.disconnect': ['🌐 Mất kết nối — trận không tính điểm', '🌐 Connection lost — match not scored'],
  'b.forfeit': ['🏳️ Đối thủ đã thoát — bạn thắng!', '🏳️ Your opponent left — you win!'],
  'b.micTap': ['👆 Chạm vào màn hình 1 lần để bật lại mic.', '👆 Tap the screen once to turn the mic back on.'],
  'b.micSilent': ['⚠ Mic không thu được âm thanh. Chạm ô Vol để bật lại, hoặc dùng nút SỦA!', '⚠ The mic isn’t picking up any sound. Tap the Vol box to retry, or use the BARK! button.'],
  'b.micTapIos': ['👆 Chạm vào màn hình 1 lần để bật mic (iPhone cần cú chạm này).', '👆 Tap the screen once to enable the mic (iPhone needs this tap).'],
  'b.micOk': ['Mic đang hoạt động', 'Mic is working'],
  'b.micOff': ['Mic chưa bật — chạm để thử lại', 'Mic is off — tap to retry'],
  'b.tapTitleMic': ['🎤 Mic đang hoạt động — hoặc chạm để sủa', '🎤 Mic is working — or tap to bark'],
  'b.tapTitle': ['🐕 Chạm để sủa', '🐕 Tap to bark'],
  'b.micOn': ['🎤 Mic đã bật — hãy sủa thật to!', '🎤 Mic on — bark as loud as you can!'],
  'b.micDenied': ['🚫 Mic đang bị chặn. Bấm biểu tượng 🔒 cạnh thanh địa chỉ → Micro → Cho phép, rồi chạm vào ô Vol để thử lại. Trong lúc đó bạn vẫn chơi được bằng nút SỦA!', '🚫 The mic is blocked. Tap the 🔒 icon next to the address bar → Microphone → Allow, then tap the Vol box to retry. You can still play with the BARK! button meanwhile.'],
  'b.micNone': ['🚫 Không tìm thấy micro. Hãy cắm micro rồi chạm vào ô Vol, hoặc chơi bằng nút SỦA!', '🚫 No microphone found. Plug one in and tap the Vol box, or play with the BARK! button.'],
  'b.micBusy': ['🚫 Micro đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi chạm vào ô Vol để thử lại.', '🚫 Another app is using the microphone. Close it, then tap the Vol box to retry.'],
  'b.micInsecure': ['🚫 Trình duyệt chỉ cho dùng mic trên https hoặc localhost. Bạn vẫn chơi được bằng nút SỦA!', '🚫 Browsers only allow the mic on https or localhost. You can still play with the BARK! button.'],
  'b.micFail': ['🚫 Không bật được mic ({name}). Chạm vào ô Vol để thử lại hoặc chơi bằng nút SỦA!', '🚫 Couldn’t turn on the mic ({name}). Tap the Vol box to retry or play with the BARK! button.'],
  'b.unknownErr': ['lỗi lạ', 'unknown error'],

  // ── Kết quả ────────────────────────────────────────
  'res.barks': [null, 'Barks'],
  'res.combo': [null, 'Combo'],
  'res.totalWp': [null, 'Total GP'],
  'res.next': ['Trận tiếp<small>Next match ▸</small>', 'Next match<small></small>'],
  'res.menu': ['Menu chính<small>Main menu</small>', 'Main menu<small></small>'],
  'res.rematch': ['Đấu lại<small>Rematch ▸</small>', 'Rematch<small></small>'],
  'res.waitOpp': ['Đang chờ đối thủ…<small>Rematch ▸</small>', 'Waiting for opponent…<small></small>'],
  'res.oppWants': ['Đối thủ muốn đấu lại!<small>Rematch ▸</small>', 'Opponent wants a rematch!<small></small>'],
  'res.oppLeft': ['Đối thủ đã rời<small></small>', 'Opponent left<small></small>'],
  'res.disconnect': ['MẤT KẾT NỐI<small></small>', 'CONNECTION LOST<small></small>'],
  'res.forfeit': ['ĐỐI THỦ BỎ CUỘC', 'OPPONENT FORFEITED'],

  // ── Xếp hạng ───────────────────────────────────────
  'rank.title': [null, 'Rankings'],
  'rank.empty': ['Chưa có trận nào! Hãy bắt đầu chiến đấu 🐕', 'No matches yet! Go fight 🐕'],
  'rank.win': ['🏆 THẮNG', '🏆 WIN'],
  'rank.lose': ['💀 THUA', '💀 LOSS'],
  'rank.ko': ['ĐO VÁN', 'KNOCKOUT'],
  'rank.forfeit': ['Đối thủ bỏ', 'Opponent left'],
  'rank.time': ['Hết giờ', 'Time up'],
  'rank.detail': ['{date} · {barks} lần sủa · combo {combo}x · +{wp} GP', '{date} · {barks} barks · combo {combo}x · +{wp} GP'],
  'rank.wins': ['THẮNG', 'WINS'],
  'rank.losses': ['THUA', 'LOSSES'],
  'rank.totalWp': ['TỔNG GP', 'TOTAL GP'],

  // ── Cài đặt ────────────────────────────────────────
  'set.mic': ['Micro', 'Microphone'],
  'set.threshold': [null, 'Bark detection threshold'],
  'set.thresholdHint': [null, 'Raise it if it triggers by mistake, lower it if the mic isn’t sensitive enough'],
  'set.micTest': ['Kiểm tra micro', 'Mic test'],
  'set.micTestBtn': [null, '🎤 Test mic'],
  'set.thrTitle': [null, 'Counts-as-bark threshold'],
  'set.barksGot': [null, 'Barks detected:'],
  'set.apply': [null, 'Use suggested level'],
  'set.redo': [null, '🎓 Calibrate mic &amp; view tutorial'],
  'set.micHint': [null, 'The white line on the bar is your current threshold: the bar turns orange when it goes over it = counted as a bark. Drag the “Threshold” slider above to see it change instantly.'],
  'set.sound': [null, 'Sound'],
  'set.sfx': [null, 'Effects volume'],
  'set.music': [null, 'Music volume'],
  'set.musicHint': [null, 'In-match music is quieter than the menu. If the mic triggers by mistake when the music is loud, turn it down or use headphones.'],
  'set.mute': [null, 'Mute'],
  'set.privacy': ['Riêng tư', 'Privacy'],
  'set.hideIp': ['Giấu IP khi chơi online', 'Hide my IP when playing online'],
  'set.hideIpHint': ['Bật: đối thủ không thấy IP của bạn (dữ liệu đi qua máy chủ trung gian TURN, trễ hơn một chút). Tắt: kết nối thẳng, nhanh hơn nhưng đối thủ có thể thấy IP. Chỉ áp dụng từ lần vào phòng kế tiếp.', 'On: your opponent can’t see your IP (data goes through a TURN relay, slightly more latency). Off: direct link, faster, but your opponent may see your IP. Applies from the next room you join.'],
  'on.privacy': ['🔒 Chế độ riêng tư (giấu IP của bạn)', '🔒 Privacy mode (hide my IP)'],
  'on.privacyHint': ['Bật: đối thủ không thấy IP của bạn, kết nối đi qua máy chủ trung gian (hơi trễ hơn). Tắt: nối thẳng, nhanh hơn nhưng đối thủ có thể thấy IP.', 'On: your opponent can’t see your IP; traffic goes through a relay (a bit more latency). Off: direct link, faster, but your opponent may see your IP.'],
  'on.diagRelayPub': ['⚠ Giấu IP đang bật nhưng chỉ có TURN công cộng (hay quá tải) — có thể không vào được phòng. Nếu lỗi, thử tắt chế độ riêng tư hoặc báo chủ game.', '⚠ IP hiding is on but only a public TURN is available (often overloaded) — joining may fail. If it does, try turning privacy mode off or tell the game owner.'],
  'set.perf': [null, 'Performance'],
  'set.gfx': [null, 'Graphics quality'],
  'set.perfAuto': [null, 'Auto (recommended)'],
  'set.perfLite': [null, 'Battery saver — weak phones / less heat'],
  'set.perfHigh': [null, 'Best quality'],
  'set.perfHint': [null, 'Battery saver: 30fps, no frosted glass or looping effects, fewer flying words. Auto switches to Battery saver if the device runs below ~38fps.'],
  'set.credits': [null, 'Credits'],
  'set.creditsText': [null, 'Music: “A Pirates Adventures” by Emmraan on <a href="https://pixabay.com/vi/music/cu%E1%BB%99c-phi%C3%AAu-l%C6%B0u-a-pirates-adventures-254111/" target="_blank" rel="noopener noreferrer">Pixabay</a> (loop-trimmed and tempo-adjusted for the game).<br>Dog barks: free sound effects from <a href="https://tiengdong.com/tieng-cho-sua" target="_blank" rel="noopener noreferrer">TiengDong.com</a>.<br>Win / lose jingles and the fallback countdown beep are generated in-game with the Web Audio API (no external audio files).'],
  'set.danger': [null, 'Danger zone'],
  'set.about': [null, 'About'],
  'set.about1': [null, 'Gaune – Gâu Gâu v1.3 🐾 — stressed? Bark it out and let it go!'],
  'set.about2': [null, 'Uses the Web Audio API to detect barks through the mic.'],
  'set.about3': [null, 'Each bark = volume × multiplier + combo bonus.'],
  'set.confirmReset': ['⚠️ Xóa toàn bộ dữ liệu? Hành động không thể hoàn tác!', '⚠️ Erase all data? This can’t be undone!'],
  'set.resetDone': ['✅ Đã xóa dữ liệu. Game sẽ về trạng thái ban đầu.', '✅ Data erased. The game is back to its initial state.'],

  // ── Kiểm tra mic (MicTest) ─────────────────────────
  'mt.stop': ['⏹ Dừng kiểm tra', '⏹ Stop test'],
  'mt.start': ['🎤 Kiểm tra mic', '🎤 Test mic'],
  'mt.applied': ['Đã áp dụng mức nhạy {n}. Nhớ bấm Quay lại để lưu.', 'Sensitivity level {n} applied. Press Back to save it.'],
  'mt.asking': ['Đang xin quyền micro… hãy bấm "Cho phép" nếu trình duyệt hỏi.', 'Asking for microphone access… tap “Allow” if your browser asks.'],
  'mt.ended': ['🚫 Micro bị ngắt (rút tai nghe / ứng dụng khác chiếm mic).', '🚫 The mic was cut off (headset unplugged / another app took it).'],
  'mt.floor': ['🤫 Đo tiếng ồn nền: giữ yên lặng 1,5 giây…', '🤫 Measuring background noise: stay quiet for 1.5 seconds…'],
  'mt.bark': ['🐕 Giờ hãy SỦA / hét to vài tiếng vào mic!', '🐕 Now BARK / shout a few times into the mic!'],
  'mt.none': ['🚫 Không thu được chút âm thanh nào. Mic có thể bị tắt tiếng, bị chặn, hoặc iPhone đang giữ âm thanh. Thử: bật quyền Micro cho trình duyệt trong Cài đặt máy, đóng ứng dụng đang dùng mic, rồi kiểm tra lại.', '🚫 No sound at all was picked up. The mic may be muted or blocked, or your iPhone is holding the audio. Try: allow Microphone for your browser in system Settings, close apps that use the mic, then test again.'],
  'mt.weak': ['⚠ Mic thu được nhưng RẤT YẾU (đỉnh {p}%). Đưa mic gần miệng hơn / sủa to hơn, hoặc kéo ngưỡng xuống mức nhạy hơn.', '⚠ The mic works but is VERY WEAK (peak {p}%). Hold it closer / bark louder, or lower the threshold.'],
  'mt.noBark': ['⚠ Mic hoạt động (đỉnh {p}%) nhưng chưa vượt ngưỡng nên không tính là sủa. Hạ ngưỡng xuống hoặc sủa to hơn.', '⚠ The mic works (peak {p}%) but never passed the threshold, so nothing counted as a bark. Lower the threshold or bark louder.'],
  'mt.good': ['✔ Mic hoạt động tốt! Đỉnh {p}%, nhận {n} tiếng sủa.', '✔ The mic works great! Peak {p}%, {n} barks detected.'],
  'mt.useLevel': ['Dùng mức gợi ý: {n}', 'Use suggested level: {n}'],
  'mt.noisy': [' Phòng khá ồn (nền {p}%) → nên hạ tiếng ồn hoặc tăng ngưỡng.', ' The room is quite noisy (background {p}%) → reduce the noise or raise the threshold.'],
  'mt.errDenied': ['🚫 Mic đang bị CHẶN. Bấm biểu tượng 🔒 cạnh thanh địa chỉ → Micro → Cho phép (iPhone: Cài đặt → Safari → Micro), rồi kiểm tra lại.', '🚫 The mic is BLOCKED. Tap the 🔒 icon next to the address bar → Microphone → Allow (iPhone: Settings → Safari → Microphone), then test again.'],
  'mt.errNone': ['🚫 Không tìm thấy micro nào trên thiết bị.', '🚫 No microphone was found on this device.'],
  'mt.errBusy': ['🚫 Micro đang được ứng dụng khác sử dụng. Đóng ứng dụng đó rồi thử lại.', '🚫 Another app is using the microphone. Close it and try again.'],
  'mt.errInsecure': ['🚫 Trình duyệt chỉ cho dùng mic trên https hoặc localhost. Trang này đang mở ở địa chỉ không an toàn.', '🚫 Browsers only allow the mic on https or localhost. This page is opened on an insecure address.'],
  'mt.errOther': ['🚫 Không bật được mic ({n}).', '🚫 Couldn’t turn on the mic ({n}).'],
  'mt.stopped': ['Đã dừng kiểm tra.', 'Test stopped.'],
  'mt.defaultMic': ['Micro mặc định', 'Default microphone'],

  // ── Online ─────────────────────────────────────────
  'on.title': [null, '2-Player Online'],
  'on.sub': [null, 'Stressed out? Bark it out! Play with a friend — one phone each 🐾'],
  'on.checking': ['Đang kiểm tra máy chủ ghép phòng…', 'Checking the matchmaking server…'],
  'on.recheck': [null, 'Recheck'],
  'on.host.h': [null, 'Create room'],
  'on.host.p': [null, 'You get a 5-character code — send it to a friend.'],
  'on.host.btn': [null, 'Create room'],
  'on.or': [null, 'or'],
  'on.join.h': [null, 'Join room'],
  'on.join.p': [null, 'Enter the code your friend sent you.'],
  'on.join.ph': [null, 'ROOM CODE'],
  'on.join.btn': [null, 'Join room'],
  'on.tip.t': [null, '💡 Connection tips'],
  'on.tip.1': [null, 'Open in <strong>Safari (iPhone)</strong> or <strong>Chrome (Android/PC)</strong> — avoid the in-app browsers of Zalo/Facebook.'],
  'on.tip.2': [null, 'Keep the screen on and <strong>don’t switch apps</strong> while waiting for your opponent.'],
  'on.room.code': [null, 'Room code'],
  'on.room.copy': [null, 'Copy invite link'],
  'on.room.hint': [null, '⚠️ Keep your phone screen on and don’t switch apps while waiting for the connection.'],
  'on.room.wait0': [null, 'Waiting for your opponent…'],
  'on.me': [null, 'YOU'],
  'on.opp': [null, 'OPPONENT'],
  'on.ready': [null, 'Ready!'],
  'on.srvGood': ['✔ Máy chủ ghép phòng ổn ({ms} ms)', '✔ Matchmaking server OK ({ms} ms)'],
  'on.srvSlow': ['⚠ Máy chủ phản hồi chậm ({ms} ms) — vẫn chơi được nhưng vào phòng có thể lâu', '⚠ The server is slow ({ms} ms) — still playable, but joining a room may take a while'],
  'on.srvVSlow': ['⚠ Mạng/máy chủ rất chậm ({ms} ms) — dễ lỗi khi vào phòng', '⚠ Network/server is very slow ({ms} ms) — joining may fail'],
  'on.srvBad': ['✖ {reason}', '✖ {reason}'],
  'on.natTesting': ['Đang thử xuyên NAT (STUN/TURN)…', 'Testing NAT traversal (STUN/TURN)…'],
  'on.diagTurnOwn': ['✔ Xuyên mạng tốt: có STUN + TURN (TURN riêng). Chơi được cả 4G/5G ↔ Wi-Fi.', '✔ Great connectivity: STUN + TURN (own TURN). Works across 4G/5G ↔ Wi-Fi.'],
  'on.diagTurnPub': ['✔ Xuyên mạng tốt: có STUN + TURN (TURN công cộng). Chơi được cả 4G/5G ↔ Wi-Fi.', '✔ Great connectivity: STUN + TURN (public TURN). Works across 4G/5G ↔ Wi-Fi.'],
  'on.diagStun': ['⚠ Chỉ có STUN, TURN không dùng được. Chơi tốt khi cùng Wi-Fi/đa số mạng nhà; 4G ↔ Wi-Fi có thể không vào được phòng.', '⚠ STUN only, TURN unavailable. Fine on the same Wi-Fi / most home networks; 4G ↔ Wi-Fi may fail to connect.'],
  'on.diagRelayOk': ['✔ Giấu IP đang bật và máy chủ TURN hoạt động: chơi được cả 4G/5G ↔ Wi-Fi, đối thủ không thấy IP của bạn.', '✔ IP hiding is on and the TURN relay works: plays across 4G/5G ↔ Wi-Fi and your opponent cannot see your IP.'],
  'on.diagRelayNone': ['✖ Chế độ giấu IP cần máy chủ TURN nhưng chưa dùng được. Thử đổi Wi-Fi ↔ 4G hoặc tắt VPN.', '✖ IP hiding needs a TURN relay but none is reachable. Try switching Wi-Fi ↔ 4G or turning off the VPN.'],
  'on.diagNone': ['✖ Không tìm được đường ra Internet cho WebRTC (mạng chặn UDP/VPN/mạng công ty). Thử đổi Wi-Fi ↔ 4G hoặc tắt VPN.', '✖ No WebRTC route to the Internet found (UDP blocked / VPN / corporate network). Try switching Wi-Fi ↔ 4G or turning off the VPN.'],
  'on.diagBad': ['✖ {reason}', '✖ {reason}'],
  'on.ping': ['Độ trễ: {ms} ms · {q}', 'Latency: {ms} ms · {q}'],
  'on.qGood': ['Mạng tốt', 'Good connection'],
  'on.qOk': ['Mạng tạm ổn', 'Fair connection'],
  'on.qBad': ['Mạng yếu ⚠', 'Weak connection ⚠'],
  'on.inApp': ['⚠ Bạn đang mở game trong trình duyệt của {app}. Trình duyệt này thường chặn mic và kết nối online. Hãy bấm ⋯ (hoặc biểu tượng chia sẻ) → "Mở bằng Safari/Chrome" rồi vào lại.', '⚠ You’re playing inside the {app} browser, which often blocks the mic and online connections. Tap ⋯ (or the share icon) → “Open in Safari/Chrome” and come back.'],
  'on.inAppSuffix': [' (Bạn đang mở trong {app}: hãy mở game bằng Safari/Chrome rồi thử lại.)', ' (You’re inside {app}: open the game in Safari/Chrome and try again.)'],
  'on.readyTag': ['✔ Sẵn sàng', '✔ Ready'],
  'on.st.wait': ['Đang chờ đối thủ… Gửi mã phòng cho bạn bè.', 'Waiting for your opponent… send the room code to a friend.'],
  'on.st.connecting': ['Đang kết nối…', 'Connecting…'],
  'on.st.waitReady': ['Đang chờ đối thủ sẵn sàng…', 'Waiting for your opponent to get ready…'],
  'on.st.yourTurn': ['Đối thủ đã sẵn sàng — đến lượt bạn!', 'Your opponent is ready — your turn!'],
  'on.st.connected': ['Đã kết nối! Chọn chiến binh rồi bấm SẴN SÀNG.', 'Connected! Pick your warrior and press READY.'],
  'on.btnCancel': ['HUỶ SẴN SÀNG', 'CANCEL READY'],
  'on.btnReady': ['SẴN SÀNG!', 'READY!'],
  'on.creating': ['Đang tạo phòng…', 'Creating room…'],
  'on.joining': ['Đang vào phòng…', 'Joining room…'],
  'on.codeLen': ['Mã phòng gồm 5 ký tự.', 'Room codes are 5 characters.'],
  'on.cantConnect': ['Không kết nối được.', 'Couldn’t connect.'],
  'on.oppLeftHost': ['Đối thủ đã rời phòng. Phòng vẫn mở — đối thủ (hoặc người khác) nhập lại mã là vào được.', 'Your opponent left. The room is still open — they (or someone else) can rejoin with the same code.'],
  'on.verMismatch': ['Hai máy đang chạy hai phiên bản game khác nhau. Cả hai hãy tải lại trang (kéo xuống để làm mới) rồi vào lại.', 'The two devices run different game versions. Both should reload the page and rejoin.'],
  'on.hostLeft': ['Chủ phòng đã rời hoặc mất kết nối. Hãy nhập lại mã hoặc tạo phòng mới.', 'The host left or lost connection. Re-enter the code or create a new room.'],
  'consent.title': ['Trước khi chơi online', 'Before you play online'],
  'consent.body': ['Chơi online dùng WebRTC. Mặc định “Chế độ riêng tư” bật: dữ liệu đi qua máy chủ trung gian (TURN) nên đối thủ không thấy IP của bạn; nếu bạn tắt chế độ này (Cài đặt → Riêng tư) thì kết nối đi thẳng và đối thủ có thể thấy IP. Máy chủ ghép phòng và máy chủ trung gian vẫn thấy IP của bạn (như mọi website). Mic không được gửi đi; chỉ có sự kiện trong trận được truyền.', 'Online play uses WebRTC. “Privacy mode” is on by default: traffic goes through a relay (TURN) so your opponent cannot see your IP; if you turn it off (Settings → Privacy) the link is direct and your opponent may see your IP. The matchmaking and relay servers can still see your IP (like any website). Your mic audio is never sent; only in-match events are.'],
  'consent.ok': ['Đồng ý & chơi', 'Agree & play'],
  'consent.cancel': ['Để sau', 'Not now'],
  'consent.link': ['Xem chính sách quyền riêng tư', 'Read the privacy policy'],
  'on.shareText': ['🐾 Vào phòng Gaune – Gâu Gâu của mình nè — buồn bực thì sủa lên, xả stress cùng nhau!\n{url}', '🐾 Join my Gaune – Gâu Gâu room — stressed? Bark it out together!\n{url}'],
  'on.copied': ['Đã sao chép lời mời! Dán vào Zalo/Messenger gửi bạn bè.', 'Invite copied! Paste it into Zalo/Messenger and send it to your friend.'],
  'on.linkIs': ['Liên kết mời: {url}', 'Invite link: {url}'],
  'on.pingBattle': ['🌐 {ms} ms{warn}', '🌐 {ms} ms{warn}'],

  // ── Lỗi mạng (NetSession) ──────────────────────────
  'net.noPeerLib': ['Không tải được thư viện PeerJS (js/vendor/peerjs.min.js).', 'Couldn’t load the PeerJS library (js/vendor/peerjs.min.js).'],
  'net.noPeerLib2': ['Không tải được thư viện PeerJS (kiểm tra mạng / file js/vendor).', 'Couldn’t load the PeerJS library (check your network / js/vendor).'],
  'net.offline': ['Máy bạn đang offline.', 'You’re offline.'],
  'net.srvTimeout': ['Máy chủ ghép phòng không phản hồi (quá thời gian chờ). Mạng quốc tế có thể bị nghẽn.', 'The matchmaking server didn’t respond (timed out). International traffic may be congested.'],
  'net.noWebrtc': ['Trình duyệt không hỗ trợ WebRTC.', 'Your browser doesn’t support WebRTC.'],
  'net.hostSlow': ['Tạo phòng quá lâu. Máy chủ ghép phòng có thể đang bận — thử lại sau ít giây.', 'Creating the room took too long. The matchmaking server may be busy — try again in a few seconds.'],
  'net.join25': ['Không kết nối được sau 25s. Kiểm tra mã phòng, hoặc mạng của một trong hai bên cần máy chủ TURN (xem hướng dẫn trong js/net/net-config.js).', 'Couldn’t connect after 25s. Check the room code — or one of the networks needs a TURN server (see js/net/net-config.js).'],
  'net.full': ['Phòng đã đầy hoặc bị đóng.', 'The room is full or closed.'],
  'net.nat': ['Hai mạng không thông được với nhau hoặc máy chủ trung gian (TURN) không dùng được. Thử đổi Wi-Fi ↔ 4G, tắt VPN; nếu đang bật chế độ riêng tư (giấu IP) thì thử tắt nó ở Cài đặt → Riêng tư.', 'The two networks can’t reach each other or the TURN relay is unavailable. Try switching Wi-Fi ↔ 4G or turning off the VPN; if privacy mode (hide IP) is on, try turning it off in Settings → Privacy.'],
  'net.notFound': ['Không tìm thấy phòng này. Kiểm tra lại mã, hoặc người tạo phòng đã thoát / để máy ngủ.', 'Room not found. Check the code — the host may have left or let their phone sleep.'],
  'net.noServer': ['Không liên lạc được máy chủ ghép phòng. Kiểm tra kết nối mạng rồi thử lại.', 'Couldn’t reach the matchmaking server. Check your connection and try again.'],
  'net.incompat': ['Trình duyệt này không hỗ trợ WebRTC.', 'This browser doesn’t support WebRTC.'],
  'net.dupId': ['Mã phòng bị trùng, hãy thử lại.', 'That room code is already taken — try again.'],
  'net.generic': ['Lỗi kết nối ({t}).', 'Connection error ({t}).'],
  'net.unknown': ['không rõ', 'unknown'],

  // ── Onboarding ─────────────────────────────────────
  'ob.skip': [null, 'Skip ›'],
  'ob.s1': [null, 'Mic'],
  'ob.s2': [null, 'How to play'],
  'ob.s3': [null, 'Start'],
  'ob.t1': [null, 'Calibrate your mic'],
  'ob.sub1': [null, 'Bark 3 times so the game learns how loud “loud” is for you — it keeps online matches fair.'],
  'ob.start': ['🎤 Bắt đầu', '🎤 Start'],
  'ob.skipStep': ['Bỏ qua bước này', 'Skip this step'],
  'ob.note': [null, '🔒 Only this step uses the mic — it’s turned off as soon as we’re done.'],
  'ob.t2': [null, 'How to play'],
  'ob.slide1.h': [null, 'The louder you bark, the harder you push'],
  'ob.slide1.p': [null, 'Bark loudly into the mic: loud barks push the power bar far harder than quiet ones.'],
  'ob.slide1.art': [null, 'WOOF!'],
  'ob.slide2.h': [null, 'Keep barking to build a COMBO'],
  'ob.slide2.p': [null, 'Bark back-to-back (pauses under ~2 seconds) to raise your combo and multiply your force (max ×2). Your dog barks every time you do.'],
  'ob.slide3.h': [null, 'The tug-of-war bar'],
  'ob.slide3.p': [null, 'Push the bar toward your opponent — push it all the way for a knockout! When the 30 seconds run out, whoever is ahead wins.'],
  'ob.slide4.h': [null, 'Your voice is what counts'],
  'ob.slide4.p': [null, 'Dog stats only help a little (a few %). No mic? Use the <b>BARK!</b> button on screen.'],
  'ob.stat1': [null, '💪 Power'],
  'ob.stat2': [null, '⚡ Speed'],
  'ob.stat3': [null, '🔥 Combo'],
  'ob.next': ['Tiếp', 'Next'],
  'ob.doneBtn': ['Xong ✓', 'Done ✓'],
  'ob.skipTut': [null, 'Skip tutorial'],
  'ob.t3': [null, 'Ready!'],
  'ob.play': [null, 'PLAY'],
  'ob.redo': [null, '🎤 Calibrate mic again'],
  'ob.chipOk': ['🎤 Mic đã chuẩn hoá ✔<small>"Sủa to" của bạn đã được game ghi nhớ.</small>', '🎤 Mic calibrated ✔<small>The game remembers how loud your “loud” is.</small>'],
  'ob.chipNo': ['🎤 Chưa chuẩn hoá mic<small>Không sao — game tự học mức sủa của bạn qua vài trận đầu.</small>', '🎤 Mic not calibrated<small>No problem — the game learns your bark level over your first few matches.</small>'],
  'ob.chipRedo': ['⚙️ Làm lại bất cứ lúc nào<small>Cài đặt → "Chuẩn hoá mic &amp; xem hướng dẫn".</small>', '⚙️ Redo it anytime<small>Settings → “Calibrate mic &amp; view tutorial”.</small>'],
  'ob.ready': ['Sẵn sàng?', 'Ready?'],
  'ob.idleMsg': ['Bấm Bắt đầu rồi làm theo hướng dẫn.', 'Press Start and follow the prompts.'],
  'ob.opening': ['Đang bật mic…', 'Turning on the mic…'],
  'ob.openingMsg': ['Hãy bấm "Cho phép" nếu trình duyệt hỏi.', 'Tap “Allow” if your browser asks.'],
  'ob.quiet': ['🤫 Giữ yên lặng…', '🤫 Stay quiet…'],
  'ob.quietMsg': ['Đang đo tiếng ồn nền (1 giây).', 'Measuring background noise (1 second).'],
  'ob.barkNow': ['SỦA THẬT TO!', 'BARK LOUD!'],
  'ob.barkMsg': ['Sủa 3 tiếng vào mic, mỗi tiếng cách nhau một chút.', 'Bark 3 times into the mic, with a short pause between each.'],
  'ob.heardNone': ['Chưa nghe thấy gì', 'Heard nothing'],
  'ob.heardNoneMsg': ['Thử đưa mic gần miệng hơn rồi bấm lại — hoặc bỏ qua và dùng nút SỦA! khi chơi.', 'Try holding the mic closer and press again — or skip and use the BARK! button when you play.'],
  'ob.retry': ['🔁 Thử lại', '🔁 Try again'],
  'ob.awesome': ['Tuyệt vời!', 'Awesome!'],
  'ob.calibrated': ['Mic đã chuẩn hoá.', 'Mic calibrated.'],
  'ob.doneHot': ['Mic đã chuẩn hoá. Mic của bạn rất nhạy — game đã tự hạ cho công bằng.', 'Mic calibrated. Your mic is very sensitive — the game turned it down to keep things fair.'],
  'ob.doneWeak': ['Mic đã chuẩn hoá. Mic hơi yếu — game đã tự bù lên.', 'Mic calibrated. Your mic is a bit weak — the game boosted it.'],
  'ob.measureAgain': ['🔁 Đo lại', '🔁 Measure again'],
  'ob.nextStep': ['Tiếp theo ›', 'Next ›'],
  'ob.errDenied': ['Mic đang bị chặn. Bấm 🔒 cạnh thanh địa chỉ → Micro → Cho phép rồi thử lại, hoặc bỏ qua và dùng nút SỦA!.', 'The mic is blocked. Tap 🔒 next to the address bar → Microphone → Allow and try again, or skip and use the BARK! button.'],
  'ob.errNone': ['Không tìm thấy micro. Bạn vẫn chơi được bằng nút SỦA!.', 'No microphone found. You can still play with the BARK! button.'],
  'ob.errInsecure': ['Trình duyệt chỉ cho dùng mic trên https. Bạn vẫn chơi được bằng nút SỦA!.', 'Browsers only allow the mic on https. You can still play with the BARK! button.'],
  'ob.errOther': ['Không bật được mic ({n}). Bạn vẫn chơi được bằng nút SỦA!.', 'Couldn’t turn on the mic ({n}). You can still play with the BARK! button.'],
  'ob.errTitle': ['Chưa bật được mic', 'Couldn’t turn on the mic'],

  // ── Dữ liệu nhân vật / bối cảnh ────────────────────
  'char.shiba.title': [null, 'Balanced Warrior'], 'char.shiba.desc': [null, 'Well-rounded in every way. Great for beginners.'],
  'char.pug.name': [null, 'Pug Warrior'], 'char.pug.title': [null, 'Slow but Heavy Hitter'], 'char.pug.desc': [null, 'Every bark hits extremely hard, but barking is slow and combos are short. Suits people who bark loud and spaced out.'],
  'char.corgi.title': [null, 'Speed of Light'], 'char.corgi.desc': [null, 'Rapid-fire barks and very long combos, but each bark is fairly light. Suits fast barkers.'],
  'char.chow.title': [null, 'Legendary Barker'], 'char.chow.desc': [null, 'Even quiet barks push hard, with moderate speed. Boss level.'],
  'char.golden.title': [null, 'Friendly Pup'], 'char.golden.desc': [null, 'Steady barks, solid power, durable combos. Reliable all match long.'],
  'char.husky.title': [null, 'Snow Mountain Singer'], 'char.husky.desc': [null, 'Long howls and sticky combos. Fearsome when you bark non-stop.'],
  'char.poodle.name': [null, 'Fluffy Poodle'], 'char.poodle.title': [null, 'Hot-Tempered Fluffball'], 'char.poodle.desc': [null, 'Shrill, super fast but light. Suits rapid-fire barkers.'],
  'char.beagle.title': [null, 'Sharp-Nosed Detective'], 'char.beagle.desc': [null, 'Balanced, leaning toward quick barks and combos.'],
  'char.labrador.name': [null, 'Black Labrador'], 'char.labrador.title': [null, 'Growling Shadow'], 'char.labrador.desc': [null, 'Deep voice, strong power, medium rhythm.'],
  'char.malamute.title': [null, 'Tough Snow Wolf'], 'char.malamute.desc': [null, 'Big and powerful with durable combos, but a bit slow.'],
  'stage.beach.name': [null, 'Beach'], 'stage.village.name': [null, 'Sunset Village'], 'stage.valley.name': [null, 'Lakeside Valley'],
  'stage.street.name': [null, 'City Street'], 'stage.temple.name': [null, 'Sacred Old Temple'],
};
/* eslint-enable max-len */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const listeners = new Set();
const origHtml = new WeakMap();     // phần tử → { html, attrs:{name:value} } — bản tiếng Việt gốc lấy từ HTML
let lang = 'vi';

function detect() {
  try { const s = localStorage.getItem(LS_LANG); if (LANGS.includes(s)) return s; } catch { /* bỏ qua */ }
  const nav = ((typeof navigator !== 'undefined' && (navigator.language || '')) || 'vi').toLowerCase();
  return nav.startsWith('vi') ? 'vi' : 'en';
}

function format(str, params, escape) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in params ? (escape ? esc(params[k]) : String(params[k])) : m));
}

function getOrig(el) {
  let o = origHtml.get(el);
  if (!o) { o = { html: el.innerHTML, attrs: {} }; origHtml.set(el, o); }
  return o;
}

export const I18n = {
  get lang() { return lang; },
  get locale() { return lang === 'vi' ? 'vi-VN' : 'en-US'; },

  init() {
    lang = detect();
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    if (lang !== 'vi') this.apply(document);
    this._meta();
  },

  /** Chuỗi theo ngôn ngữ hiện tại. params được thoát HTML nếu chuỗi sẽ chèn vào innerHTML (dùng tHtml) */
  t(key, params) {
    const e = S[key];
    if (!e) return key;
    const s = lang === 'vi' ? (e[0] ?? e[1]) : e[1];
    return format(s, params, false);
  },

  /** Giống t() nhưng thoát HTML các tham số (dùng khi chèn bằng innerHTML) */
  tHtml(key, params) {
    const e = S[key];
    if (!e) return esc(key);
    const s = lang === 'vi' ? (e[0] ?? e[1]) : e[1];
    return format(s, params, true);
  },

  /** Gắn khoá vào phần tử: hiển thị ngay và tự dịch lại khi đổi ngôn ngữ. */
  bind(el, key, params = null) {
    if (!el) return;
    el.dataset.i18n = key;
    if (params) el.dataset.i18nP = JSON.stringify(params); else delete el.dataset.i18nP;
    el.innerHTML = this._render(el, key, params);
  },

  /** Hiển thị văn bản thường (không dịch) và gỡ khoá đã gắn */
  setText(el, text) {
    if (!el) return;
    delete el.dataset.i18n; delete el.dataset.i18nP;
    el.textContent = text ?? '';
  },

  _render(el, key, params) {
    const e = S[key];
    if (lang === 'vi') {
      if (e && e[0] != null) return format(e[0], params, true);
      return getOrig(el).html;                     // khoá chỉ có trong HTML: giữ nguyên tiếng Việt gốc
    }
    return e ? format(e[1], params, true) : getOrig(el).html;
  },

  /** Áp dụng cho một vùng DOM: [data-i18n] và [data-i18n-attr="thuộc-tính:khoá;…"] */
  apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      let params = null;
      if (el.dataset.i18nP) { try { params = JSON.parse(el.dataset.i18nP); } catch { /* bỏ qua */ } }
      getOrig(el);
      const html = this._render(el, key, params);
      if (el.innerHTML !== html) el.innerHTML = html;
    });
    root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      const o = getOrig(el);
      el.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (!attr || !key) return;
        if (!(attr in o.attrs)) o.attrs[attr] = el.getAttribute(attr) ?? '';
        const e = S[key];
        const v = lang === 'vi' ? (e && e[0] != null ? e[0] : o.attrs[attr]) : (e ? e[1] : o.attrs[attr]);
        el.setAttribute(attr, v);
      });
    });
  },

  set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    try { localStorage.setItem(LS_LANG, lang); } catch { /* bỏ qua */ }
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    this.apply(document);
    this._meta();
    listeners.forEach((fn) => { try { fn(lang); } catch (e) { console.warn('[I18n] listener lỗi:', e); } });
  },

  toggle() { this.set(lang === 'vi' ? 'en' : 'vi'); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  _meta() {
    const en = lang === 'en';
    document.title = en ? 'Gaune – Gâu Gâu – Stressed? Bark into the mic and let it out'
                        : 'Gaune – Gâu Gâu – Buồn bực? Sủa vào mic để xả stress cùng mình';
    const d = document.querySelector('meta[name="description"]');
    if (d) d.content = en
      ? 'Stressed? Bark it out! Gaune – Gâu Gâu: bark into the mic to push your opponent back. Play the bot or 2-player online, free in your browser.'
      : 'Buồn bực thì sủa lên để giải tỏa cùng mình! Gaune – Gâu Gâu: sủa vào mic để đẩy lùi đối thủ. Chơi với bot hoặc đấu online 2 người, miễn phí ngay trên trình duyệt.';
  },

  // ── Dữ liệu nhân vật / bối cảnh (giữ nguyên id, chỉ đổi chữ hiển thị) ──
  charName(c)  { return (lang === 'en' && S[`char.${c.id}.name`]?.[1]) || c.name; },
  charTitle(c) { return (lang === 'en' && S[`char.${c.id}.title`]?.[1]) || c.title; },
  charDesc(c)  { return (lang === 'en' && S[`char.${c.id}.desc`]?.[1]) || c.description; },
  stageName(s) { return (lang === 'en' && S[`stage.${s.id}.name`]?.[1]) || s.name; },
};

export const t = (k, p) => I18n.t(k, p);
