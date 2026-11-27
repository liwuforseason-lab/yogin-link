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

  /* 글자를 폭에 맞춰 줄바꿈. maxLines 넘으면 말줄임. */
  function wrap(ctx, text, maxWidth, maxLines) {
    var chars = String(text || "").split("");
    var lines = [];
    var line = "";
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch === "\n") {
        lines.push(line);
        line = "";
        if (lines.length >= maxLines) break;
        continue;
      }
      var test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
        if (lines.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (lines.length < maxLines && line) lines.push(line);

    var full = String(text || "").replace(/\n/g, " ");
    if (lines.length === maxLines && lines.join("").length < full.length) {
      var last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + "…").width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last.replace(/\s+$/, "") + "…";
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

    /* 이미지 패널 */
    var imgTop = 186;
    var imgH = 570;
    var imgW = W - PAD * 2;
    ctx.save();
    ctx.shadowColor = "rgba(180,124,106,0.18)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, PAD, imgTop, imgW, imgH, 44);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, PAD, imgTop, imgW, imgH, 44);
    ctx.clip();
    if (img && img.width) {
      var pad = 26;
      var bw = imgW - pad * 2;
      var bh = imgH - pad * 2;
      var r = Math.min(bw / img.width, bh / img.height);
      var dw = img.width * r;
      var dh = img.height * r;
      ctx.drawImage(img, PAD + (imgW - dw) / 2, imgTop + (imgH - dh) / 2, dw, dh);
    } else {
      var ph = ctx.createLinearGradient(PAD, imgTop, PAD + imgW, imgTop + imgH);
      ph.addColorStop(0, "#fff4ee");
      ph.addColorStop(1, "#f6e3d9");
      ctx.fillStyle = ph;
      ctx.fillRect(PAD, imgTop, imgW, imgH);
      ctx.fillStyle = "#c9a294";
      ctx.font = font(120, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🛍️", PAD + imgW / 2, imgTop + imgH / 2 - 20);
      ctx.font = font(30, 700);
      ctx.fillStyle = "#b08b7d";
      ctx.fillText("상품 사진을 넣어 주세요", PAD + imgW / 2, imgTop + imgH / 2 + 90);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
    }
    ctx.restore();

    /* 번호 칩 */
    if (d.no) pill(ctx, PAD + 28, imgTop + 26, d.no, { bg: C.ink, size: 30, h: 56 });

    /* 할인 배지 */
    if (d.discount) {
      var bx = W - PAD - 30;
      var by = imgTop + 30;
      var rad = 92;
      var cx = bx - rad;
      var cy = by + rad;
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
      pill(ctx, W - PAD - 30 - 200, imgTop + 34, d.badge, { bg: "#ffffff", color: C.roseDeep, size: 26, h: 54 });
    }

    /* 제목 */
    ctx.fillStyle = C.ink;
    ctx.font = font(60, 800);
    var titleLines = wrap(ctx, d.title, imgW, 2);
    var y = 800;
    titleLines.forEach(function (ln) {
      ctx.fillText(ln, PAD, y);
      y += 74;
    });

    /* 한 줄 특징 */
    if (d.point) {
      ctx.fillStyle = C.soft;
      ctx.font = font(33, 600);
      var pLines = wrap(ctx, d.point, imgW, 2);
      var py = Math.max(y + 12, 962);
      pLines.forEach(function (ln) {
        ctx.fillText(ln, PAD, py);
        py += 45;
      });
    }

    /* 가격 */
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, 1082);
    ctx.lineTo(W - PAD, 1082);
    ctx.stroke();

    if (d.originalPrice && d.discount) {
      ctx.fillStyle = C.faint;
      ctx.font = font(36, 600);
      var ow = ctx.measureText(won(d.originalPrice)).width;
      ctx.fillText(won(d.originalPrice), PAD, 1102);
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(PAD, 1128);
      ctx.lineTo(PAD + ow, 1128);
      ctx.stroke();
    }

    ctx.fillStyle = C.roseDeep;
    ctx.font = font(82, 800);
    ctx.fillText(won(d.price), PAD, 1146);

    if (d.badge) {
      pill(ctx, W - PAD - 30 - 210, 1150, d.badge, { bg: "#fff1ee", color: C.roseDeep, size: 26, h: 54 });
    }

    /* 하단 */
    ctx.fillStyle = C.ink;
    ctx.font = font(26, 800);
    var footY = 1252;
    var label = d.no ? "번호 " + d.no + " 로 검색" : "번호로 검색";
    ctx.fillText(label, PAD, footY);
    var lw = ctx.measureText(label).width;

    ctx.fillStyle = C.soft;
    ctx.font = font(22, 600);
    ctx.fillText("liwuforseason-lab.github.io/yogin-link", PAD + lw + 18, footY + 3);

    ctx.fillStyle = C.faint;
    ctx.font = font(17, 500);
    var disc = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
    wrap(ctx, disc, imgW, 2).forEach(function (ln, i) {
      ctx.fillText(ln, PAD, 1294 + i * 24);
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
