/* 요긴상회 · 핫딜 스튜디오 — 인스타 카드 이미지 (1080×1350 Canvas)
   상품 사진 + 할인율 + 가격 + 번호를 한 장으로 그립니다. */
window.YG = window.YG || {};

(function (YG) {
  "use strict";

  var W = 1080;
  var H = 1350;
  var PAD = 64;
  var FONT = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

  var C = {
    ink: "#3b2b26",
    soft: "#7a665e",
    faint: "#a5948c",
    rose: "#e8827e",
    roseDeep: "#d9615f",
    line: "#e8cfc2"
  };

  function font(size, weight) {
    return (weight || 700) + " " + size + "px " + FONT;
  }

  function won(n) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "";
    return Number(n).toLocaleString("ko-KR") + "원";
  }

  function roundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /* 글자를 폭에 맞춰 줄바꿈. 공백 단위로 먼저 끊고, maxLines 넘으면 말줄임. */
  function wrap(ctx, text, maxWidth, maxLines) {
    var words = String(text || "").replace(/\n/g, " ").split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = "";
    var i = 0;
    var overflow = false;

    while (i < words.length) {
      var w = words[i];
      var cand = cur ? cur + " " + w : w;
      if (ctx.measureText(cand).width <= maxWidth) {
        cur = cand;
        i += 1;
        continue;
      }
      if (cur) {
        lines.push(cur);
        cur = "";
        if (lines.length >= maxLines) { overflow = true; break; }
        continue;
      }
      // 한 단어가 한 줄보다 길면 글자 단위로 끊기
      var chars = w.split("");
      var part = "";
      for (var k = 0; k < chars.length; k++) {
        if (ctx.measureText(part + chars[k]).width > maxWidth && part) {
          lines.push(part);
          part = chars[k];
          if (lines.length >= maxLines) { overflow = true; break; }
        } else {
          part += chars[k];
        }
      }
      if (overflow) break;
      cur = part;
      i += 1;
    }
    if (!overflow && cur) lines.push(cur);
    if (i < words.length) overflow = true;

    if (overflow && lines.length) {
      var last = lines[lines.length - 1];
      while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = last.replace(/\s+$/, "") + "…";
    }
    return lines;
  }

  function pill(ctx, x, y, text, opts) {
    opts = opts || {};
    ctx.font = font(opts.size || 28, opts.weight || 800);
    var tw = ctx.measureText(text).width;
    var padX = opts.padX || 22;
    var h = opts.h || 52;
    var w = tw + padX * 2;
    if (opts.measure) return w;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = opts.bg || C.ink;
    ctx.fill();
    ctx.fillStyle = opts.color || "#fff8f2";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    return w;
  }

  function draw(canvas, d, img) {
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext("2d");

    /* 배경 */
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#fff8f2");
    g.addColorStop(0.55, "#fdeee6");
    g.addColorStop(1, "#f9ddd2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.34)";
    ctx.beginPath();
    ctx.arc(W - 60, 40, 260, 0, Math.PI * 2);
    ctx.fill();

    /* 브랜드 */
    var mg = ctx.createLinearGradient(PAD, 62, PAD + 84, 146);
    mg.addColorStop(0, "#f5a29a");
    mg.addColorStop(1, C.roseDeep);
    roundRect(ctx, PAD, 62, 84, 84, 28);
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.fillStyle = "#fff8f2";
    ctx.font = font(44, 800);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("요", PAD + 42, 106);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.fillStyle = C.ink;
    ctx.font = font(44, 800);
    ctx.fillText("요긴상회", PAD + 104, 72);
    ctx.fillStyle = C.soft;
    ctx.font = font(24, 600);
    ctx.fillText("생활꿀템 번호 검색", PAD + 106, 124);

    /* 이미지 패널 — 사진 비율에 맞춰 카드가 따라갑니다 */
    var contentW = W - PAD * 2;
    var bandTop = 186;
    var bandBottom = 762;
    var maxW = contentW;
    var maxH = bandBottom - bandTop - 56;
    var pad = 28;
    var dw;
    var dh;
    if (img && img.width) {
      var r = Math.min(maxW / img.width, maxH / img.height);
      dw = img.width * r;
      dh = img.height * r;
    } else {
      dw = 520;
      dh = 420;
    }
    var panelW = dw + pad * 2;
    var panelH = dh + pad * 2;
    var panelX = (W - panelW) / 2;
    var panelY = bandTop + (bandBottom - bandTop - panelH) / 2;

    ctx.save();
    ctx.shadowColor = "rgba(180,124,106,0.18)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, panelX, panelY, panelW, panelH, 44);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, panelX, panelY, panelW, panelH, 44);
    ctx.clip();
    if (img && img.width) {
      ctx.drawImage(img, panelX + pad, panelY + pad, dw, dh);
    } else {
      var ph = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
      ph.addColorStop(0, "#fff4ee");
      ph.addColorStop(1, "#f6e3d9");
      ctx.fillStyle = ph;
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.fillStyle = "#c9a294";
      ctx.font = font(120, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🛍️", panelX + panelW / 2, panelY + panelH / 2 - 20);
      ctx.font = font(30, 700);
      ctx.fillStyle = "#b08b7d";
      ctx.fillText("상품 사진을 넣어 주세요", panelX + panelW / 2, panelY + panelH / 2 + 90);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
    }
    ctx.restore();

    /* 번호 칩 */
    if (d.no) pill(ctx, panelX + 24, panelY + 22, d.no, { bg: C.ink, size: 30, h: 56 });

    /* 할인 배지 */
    if (d.discount) {
      var rad = 92;
      var cx = panelX + panelW - 24 - rad;
      var cy = panelY + 22 + rad;
      var bg = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
      bg.addColorStop(0, "#f39a92");
      bg.addColorStop(1, C.roseDeep);
      ctx.save();
      ctx.shadowColor = "rgba(217,97,95,0.32)";
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#fff8f2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = font(62, 800);
      ctx.fillText(d.discount + "%", cx, cy - 14);
      ctx.font = font(26, 700);
      ctx.fillText("할인", cx, cy + 44);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
    } else if (d.badge) {
      var bw0 = pill(ctx, 0, 0, d.badge, { bg: "#ffffff", color: C.roseDeep, size: 26, h: 54, measure: true });
      pill(ctx, panelX + panelW - 24 - bw0, panelY + 26, d.badge, { bg: "#ffffff", color: C.roseDeep, size: 26, h: 54 });
    }

    /* 제목 */
    ctx.fillStyle = C.ink;
    ctx.font = font(60, 800);
    var titleLines = wrap(ctx, d.title, contentW, 2);
    var y = 800;
    titleLines.forEach(function (ln) {
      ctx.fillText(ln, PAD, y);
      y += 74;
    });

    /* 한 줄 특징 */
    if (d.point) {
      ctx.fillStyle = C.soft;
      ctx.font = font(32, 600);
      var pLines = wrap(ctx, d.point, contentW, 2);
      var py = Math.max(y + 8, 958);
      pLines.forEach(function (ln) {
        ctx.fillText(ln, PAD, py);
        py += 43;
      });
    }

    /* 가격 */
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, 1068);
    ctx.lineTo(W - PAD, 1068);
    ctx.stroke();

    if (d.originalPrice && d.discount) {
      ctx.fillStyle = C.faint;
      ctx.font = font(34, 600);
      var ow = ctx.measureText(won(d.originalPrice)).width;
      ctx.fillText(won(d.originalPrice), PAD, 1086);
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(PAD, 1110);
      ctx.lineTo(PAD + ow, 1110);
      ctx.stroke();
    }

    ctx.fillStyle = C.roseDeep;
    ctx.font = font(74, 800);
    ctx.fillText(won(d.price), PAD, 1122);
    var priceW = ctx.measureText(won(d.price)).width;

    if (d.badge) {
      var bw = pill(ctx, 0, 0, d.badge, { bg: "#fff1ee", color: C.roseDeep, size: 25, h: 50, padX: 20, measure: true });
      pill(ctx, W - PAD - bw, 1128, d.badge, { bg: "#fff1ee", color: C.roseDeep, size: 25, h: 50, padX: 20 });
    }

    /* 하단 */
    ctx.fillStyle = C.ink;
    ctx.font = font(26, 800);
    var footY = 1236;
    var label = d.no ? "번호 " + d.no + " 로 검색" : "번호로 검색";
    ctx.fillText(label, PAD, footY);
    var lw = ctx.measureText(label).width;

    ctx.fillStyle = C.soft;
    ctx.font = font(22, 600);
    ctx.fillText("liwuforseason-lab.github.io/yogin-link", PAD + lw + 18, footY + 3);

    ctx.fillStyle = C.faint;
    ctx.font = font(17, 500);
    var disc = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
    wrap(ctx, disc, contentW, 2).forEach(function (ln, i) {
      ctx.fillText(ln, PAD, 1290 + i * 23);
    });
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error("blob 실패")); }, "image/png");
      } else {
        reject(new Error("toBlob 미지원"));
      }
    });
  }

  YG.card = { draw: draw, toBlob: toBlob, W: W, H: H };
})(window.YG);
