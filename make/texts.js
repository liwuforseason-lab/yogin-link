/* 요긴상회 · 핫딜 스튜디오 — 글 생성기
   상품 정보 하나로 블로그·인스타·스레드 문구를 만듭니다.
   · 담백한 ~요체, 한 문장 한 줄, AI 느낌 나는 상투어 최소화
   · 같은 상품도 '다시 생성'을 누르면 문장 조합이 바뀝니다. */
window.YG = window.YG || {};

(function (YG) {
  "use strict";

  var DISCLOSURE =
    "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";
  var DISCLOSURE_SHORT = "※ 쿠팡 파트너스 활동으로 일정액의 수수료를 받을 수 있어요.";
  var HQ = "https://liwuforseason-lab.github.io/yogin-link/";

  function won(n) {
    if (n === null || n === undefined || n === "" || isNaN(n)) return "";
    return Number(n).toLocaleString("ko-KR") + "원";
  }

  function hash(str) {
    var h = 0;
    str = String(str || "");
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 100000;
    return h;
  }

  function pick(list, d, salt) {
    var i = (hash(d.title) + (d.seed || 0) * 7 + (salt || 0)) % list.length;
    return list[i];
  }

  /* 받침에 따라 조사를 골라 줍니다. josa('전기요','을','를') → '를' */
  function hasJong(ch) {
    var code = String(ch || "").charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return false;
    return (code - 0xac00) % 28 !== 0;
  }
  function josa(word, withJong, noJong) {
    var w = String(word || "").trim();
    var last = w.charAt(w.length - 1);
    return hasJong(last) ? withJong : noJong;
  }
  function eul(word) { return word + josa(word, "을", "를"); }
  function i(word) { return word + josa(word, "이", "가"); }
  function sentence(s) {
    var t = String(s || "").trim();
    if (!t) return "";
    return /[.!?~]$/.test(t) ? t : t + ".";
  }

  var EMOJI = [
    ["전기요|전기매트|전기장판|온수매트|담요|이불", "🧣"],
    ["히터|난로|온풍기", "🔥"],
    ["핫팩|손난로", "♨️"],
    ["화장지|휴지|두루마리|물티슈|키친타월", "🧻"],
    ["콜라|사이다|음료|주스|커피|물|맥주", "🥤"],
    ["크림|로션|샴푸|세안|화장품|선크림|보습", "🧴"],
    ["냄비|프라이팬|팬|웍|주방|식기|그릇", "🍳"],
    ["맨투맨|티셔츠|니트|바지|패딩|양말|옷", "🧥"],
    ["마스크|치약|칫솔|세제|섬유유연제", "🧼"],
    ["건전지|충전기|케이블|가전|청소기", "🔌"],
    ["간식|과자|라면|햇반|식품|김치", "🍪"],
    ["신발|운동화|슬리퍼", "👟"],
    ["가방|파우치|지갑", "👜"],
    ["우산|장갑|목도리", "☂️"]
  ];

  function emojiFor(d) {
    var hay = [d.title, d.point, (d.keywords || []).join(" ")].join(" ");
    for (var i = 0; i < EMOJI.length; i++) {
      if (new RegExp(EMOJI[i][0]).test(hay)) return EMOJI[i][1];
    }
    return "🛒";
  }

  /* ---------- 해시태그 ---------- */
  var BASE_TAGS = ["#핫딜", "#최저가", "#쿠팡특가", "#생활꿀템", "#요긴상회"];

  function hashtags(d, max) {
    var out = [];
    (d.keywords || []).forEach(function (k) {
      var tag = "#" + String(k).replace(/[\s#]/g, "");
      if (tag.length > 2 && out.indexOf(tag) === -1) out.push(tag);
    });
    BASE_TAGS.forEach(function (t) {
      if (out.indexOf(t) === -1) out.push(t);
    });
    return out.slice(0, max || 10).join(" ");
  }

  /* ---------- 블로그 ---------- */
  function blogTitle(d) {
    var kw = d.kw1 || d.short || d.title;
    var t = [
      kw + " " + d.discount + "% 할인, " + won(d.price) + "이면 살 만한 이유",
      kw + " 최저가 " + won(d.price) + " · 정가 " + won(d.originalPrice) + "에서 " + d.discount + "% 내렸어요",
      (d.short || kw) + " " + d.discount + "% 특가, 사기 전에 볼 것만 정리했어요",
      kw + " 고민 중이면 보세요 · " + d.discount + "% 할인해서 " + won(d.price)
    ];
    if (!d.discount) {
      t = [
        kw + " 가격 정리 · " + won(d.price) + "이면 어떤지 봤어요",
        kw + " 살까 고민될 때 보는 가격·구성 정리",
        kw + " 후기 보기 전에 확인할 것들"
      ];
    }
    return pick(t, d, 1);
  }

  function intro(d) {
    var kw = d.kw1;
    var sets = [];
    if (d.discount) {
      sets = [
        [
          kw + " 가격 알아보고 있었는데 " + d.discount + "% 할인 중이라 그냥 지나칠 수가 없었어요.",
          "정가 " + won(d.originalPrice) + "이 " + won(d.price) + "이에요. " + won(d.saved) + "이 빠진 금액이에요.",
          "가격은 수시로 바뀌니까 결제 전에 링크에서 한 번 더 확인해 주세요."
        ],
        [
          "요즘 " + kw + " 찾는 분들이 많아서 가격부터 정리해 봤어요.",
          d.title + ", 지금 " + d.discount + "% 할인해서 " + won(d.price) + "이에요.",
          "정가로 사면 " + won(d.saved) + "을 더 내는 셈이라, 필요했던 분들은 이번에 보시면 좋겠어요."
        ],
        [
          kw + " 하나 장만할까 고민하던 차에 " + d.discount + "% 특가가 떠서 정리해 봐요.",
          won(d.originalPrice) + "짜리가 " + won(d.price) + "이에요.",
          "아래에 가격이랑 사기 전에 볼 점 같이 적어 뒀어요."
        ]
      ];
    } else {
      sets = [
        [
          kw + " 가격 알아보다가 " + won(d.price) + "인 걸 보고 정리해 봤어요.",
          "필요했던 분들은 아래 내용 보고 판단하시면 돼요.",
          "가격은 수시로 바뀌니까 결제 전에 링크에서 확인하는 게 안전해요."
        ]
      ];
    }
    return pick(sets, d, 2).filter(Boolean);
  }

  function blogBody(d) {
    var L = [];
    intro(d).forEach(function (line) { L.push(line); });
    L.push("");

    // 1. 가격
    L.push("1. 가격 정리");
    L.push("");
    if (d.originalPrice && d.discount) {
      L.push("· 정가: " + won(d.originalPrice));
      L.push("· 할인가: " + won(d.price));
      L.push("· 할인율: " + d.discount + "%");
      L.push("· 아낀 금액: " + won(d.saved));
    } else {
      L.push("· 판매가: " + won(d.price));
    }
    if (d.note) L.push("· 참고: " + d.note);
    L.push("");

    // 2. 상품 소개
    L.push("2. 어떤 상품인지");
    L.push("");
    L.push(d.title + josa(d.title, "이에요", "예요") + ".");
    if (d.point) L.push(sentence(d.point));
    var kws = (d.keywords || []).slice(0, 3);
    if (kws.length >= 2) {
      L.push(kws[1] + "·" + (kws[2] || kws[1]) + " 쪽으로 같이 찾아보시는 분들이 비교하기 좋은 구성이에요.");
    }
    L.push("");

    // 3. 맞는 경우
    L.push("3. 이럴 때 맞아요");
    L.push("");
    L.push("· " + eul(d.kw1) + " 처음 장만하는 분");
    L.push("· 쓰던 걸 바꿀 때가 된 분");
    if (kws[1]) L.push("· " + kws[1] + "까지 같이 챙기려는 분");
    L.push("");

    // 4. 장단점
    L.push("4. 장단점");
    L.push("");
    L.push("장점");
    if (d.discount) {
      L.push("· " + won(d.originalPrice) + " → " + won(d.price) + ", " + won(d.saved) + " 아낌 (" + d.discount + "%)");
    } else {
      L.push("· " + won(d.price) + " 가격");
    }
    if (d.note) L.push("· " + d.note);
    L.push("아쉬운 점");
    L.push("· 확인한 시점 가격이라, 결제 화면에서 금액이 달라질 수 있어요.");
    L.push("· 색상·사이즈·수량 옵션에 따라 가격이 다를 수 있어요.");
    L.push("· 최근 리뷰에 배송 지연이나 파손 얘기가 있는지 한 번 보세요.");
    L.push("");

    // 5. 정리
    L.push("5. 정리");
    L.push("");
    L.push(i(d.kw1) + " 필요했던 분들은 " + won(d.price) + "이면 한 번 계산해 보실 만해요.");
    L.push("가격은 다시 오를 수 있으니 링크에서 최종 금액 확인하고 결정하세요.");
    L.push("궁금한 점은 댓글로 남겨 주세요.");
    L.push("");

    if (d.link) {
      L.push("▶ 상품 링크: " + d.link);
      L.push("");
    }
    L.push(DISCLOSURE);
    L.push("");
    L.push(hashtags(d, 10));

    return L.join("\n");
  }

  /* ---------- 인스타 ---------- */
  function instaHook(d) {
    var kw = d.kw1;
    var t = d.discount
      ? [
          kw + " " + d.discount + "% 빠졌어요. 지금 " + won(d.price) + "이에요.",
          "정가 " + won(d.originalPrice) + " → " + won(d.price) + ". " + kw + " 기다리던 분들 지금이에요.",
          kw + " 이 가격이면 고민할 필요 없어요. " + d.discount + "% 할인 중이에요."
        ]
      : [
          kw + " " + won(d.price) + "에 나왔어요. 구성 보면 이해돼요.",
          kw + " 가격 정리해 봤어요. " + won(d.price) + "이에요."
        ];
    return pick(t, d, 3);
  }

  function instaCaption(d) {
    var L = [];
    L.push(emojiFor(d) + " " + instaHook(d));
    L.push(d.title);
    if (d.originalPrice && d.discount) {
      L.push(won(d.originalPrice) + " → " + won(d.price) + " (" + d.discount + "% 할인)");
    } else {
      L.push(won(d.price));
    }
    L.push("");
    if (d.point) { L.push(d.point); L.push(""); }
    if (d.note) { L.push("· " + d.note); L.push(""); }
    L.push("번호 " + d.no + " 로 검색하면 바로 연결돼요.");
    L.push("프로필 링크 → 번호 입력");
    L.push("");
    L.push(DISCLOSURE);
    L.push("");
    L.push(hashtags(d, 12));
    return L.join("\n");
  }

  /* ---------- 스레드 ---------- */
  function threads(d) {
    var kw = d.kw1;
    var hooks = d.discount
      ? [
          kw + " " + d.discount + "% 할인이라길래 봤더니 " + won(d.price) + "이에요.",
          kw + " " + d.discount + "% 빠졌어요. " + won(d.price) + "이면 살 만해요.",
          "정가 " + won(d.originalPrice) + "짜리가 " + won(d.price) + "이에요. " + kw + " 찾던 분들 보세요."
        ]
      : [kw + " " + won(d.price) + "에 나왔어요."];
    var hook = pick(hooks, d, 4);

    var lines = [hook];
    if (d.point) lines.push(d.point);
    if (d.originalPrice && d.discount) {
      lines.push(won(d.originalPrice) + " → " + won(d.price) + " (" + d.discount + "%)");
    }
    lines.push("👉 " + HQ + "?n=" + d.no);
    lines.push(DISCLOSURE_SHORT);

    var text = lines.join("\n");
    // 스레드 500자 제한
    if (text.length > 480) {
      lines = [hook, won(d.price) + " · " + (d.discount ? d.discount + "% 할인" : "특가")];
      lines.push("👉 " + HQ + "?n=" + d.no);
      text = lines.join("\n");
    }
    return text;
  }

  YG.texts = {
    DISCLOSURE: DISCLOSURE,
    HQ: HQ,
    won: won,
    hashtags: hashtags,
    emojiFor: emojiFor,
    blogTitle: blogTitle,
    blogBody: blogBody,
    instaCaption: instaCaption,
    threads: threads
  };
})(window.YG);
