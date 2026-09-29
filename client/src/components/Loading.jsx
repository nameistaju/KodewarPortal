import React from 'react';

const Loading = () => {
  return (
    <div className="loader-container">
      <style>{`
        :root {
          --ink: #05070a;
          --panel: #0b0e13;
          --accent: #31B6FF;
          --accent-soft: rgba(49, 182, 255, 0.35);
        }

        .loader-container {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          background-color: var(--ink);
          background-image: url('/bgForLoader.png');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif;
          z-index: 9999;
        }

        .stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 28px;
        }

        .mark {
          position: relative;
          width: 220px;
          height: 220px;
        }

        /* soft ambient glow behind the badge, breathing slowly */
        .mark::before {
          content: "";
          position: absolute;
          inset: -30%;
          background: radial-gradient(circle, var(--accent-soft) 0%, transparent 65%);
          filter: blur(18px);
          animation: breathe 3.2s ease-in-out infinite;
          z-index: 0;
        }

        .badge {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 28px;
          background: linear-gradient(165deg, #0d1117 0%, #060708 100%);
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.04),
            0 20px 60px -15px rgba(0, 0, 0, 0.7),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .stage svg {
          width: 62%;
          height: 62%;
          overflow: visible;
        }

        .stroke {
          fill: none;
          stroke: var(--accent);
          stroke-width: 38;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 6px rgba(49, 182, 255, 0.55));
        }

        /* each stroke gets its own dash length (= true path length) + timed draw-in, draw-out loop */
        .stroke-1 {
          stroke-dasharray: 936;
          stroke-dashoffset: 936;
          animation: draw 2.6s cubic-bezier(.65, 0, .35, 1) infinite;
          animation-delay: 0s;
        }
        .stroke-2 {
          stroke-dasharray: 2451;
          stroke-dashoffset: 2451;
          animation: draw 2.6s cubic-bezier(.65, 0, .35, 1) infinite;
          animation-delay: 0.18s;
        }
        .stroke-3 {
          stroke-dasharray: 1022;
          stroke-dashoffset: 1022;
          animation: draw 2.6s cubic-bezier(.65, 0, .35, 1) infinite;
          animation-delay: 0.36s;
        }

        @keyframes draw {
          0% {
            stroke-dashoffset: var(--len);
            opacity: 0.25;
          }
          8% {
            opacity: 1;
          }
          42% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          65% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: calc(var(--len) * -1);
            opacity: 0.25;
          }
        }

        .stroke-1 { --len: 936; }
        .stroke-2 { --len: 2451; }
        .stroke-3 { --len: 1022; }

        @keyframes breathe {
          0%, 100% { opacity: 0.55; transform: scale(0.94); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        .label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .word {
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #e9edf2;
        }

        .sub {
          font-size: 12px;
          letter-spacing: 0.08em;
          color: #5b6470;
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .sub .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
          animation: blink 1.4s ease-in-out infinite;
        }
        .sub .dot:nth-child(2) { animation-delay: 0.18s; }
        .sub .dot:nth-child(3) { animation-delay: 0.36s; }

        @keyframes blink {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .mark::before, .stroke-1, .stroke-2, .stroke-3, .sub .dot {
            animation: none !important;
          }
          .stroke-1, .stroke-2, .stroke-3 {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
      `}</style>

      <div className="stage">
        <div className="mark">
          <div className="badge">
            <svg viewBox="230 230 970 560" xmlns="http://www.w3.org/2000/svg">
              <path className="stroke stroke-1" d="M438.997742,306.998718 C455.481110,291.489044 474.202332,280.233124 495.585785,273.957092 C506.442749,270.770569 517.706116,268.558929 528.942078,267.183899 C541.194336,265.684479 553.625916,265.125153 565.982056,265.088135 C630.473083,264.894958 694.964905,264.998260 759.456482,264.998444 C785.707642,264.998505 811.958923,264.959961 838.209839,265.038696 C842.302246,265.050964 846.393066,265.597900 850.959656,265.932373 C842.887390,273.475922 835.251648,280.720428 827.487793,287.824921 C823.010437,291.922028 818.234985,295.693054 813.752380,299.784729 C802.034302,310.480713 789.855347,320.752991 778.968384,332.244141 C773.489319,338.027191 767.940308,339.088409 760.780090,339.078552 C694.115051,338.986908 627.449768,339.161407 560.784546,339.172638 C511.375275,339.180939 461.966034,339.061737 412.556763,338.993988 C411.919434,338.993134 411.282166,338.921936 409.201385,338.796753 C419.472656,327.721191 429.057434,317.385864 438.997742,306.998718 z"/>
              <path className="stroke stroke-2" d="M996.271362,426.228027 C985.624878,436.536987 975.271423,446.641479 964.830627,456.654999 C948.932251,471.902618 933.003906,487.119354 917.029297,502.287048 C907.001526,511.808228 896.865784,521.215698 886.311768,531.111938 C892.386292,536.734985 898.067627,542.158203 903.929382,547.378906 C911.447815,554.075256 919.145508,560.570007 926.704895,567.220947 C940.592163,579.439148 954.447510,591.693848 968.290710,603.962097 C975.196960,610.082703 982.017456,616.300049 988.928406,622.415222 C1002.988464,634.856079 1017.096619,647.242615 1031.158569,659.681396 C1037.591797,665.372009 1043.919678,671.181946 1050.370239,676.852539 C1063.597778,688.480408 1076.889771,700.034485 1090.127808,711.650330 C1098.801880,719.261658 1107.421021,726.935730 1116.077393,734.567261 C1123.971069,741.526428 1131.882080,748.466187 1140.441528,755.991272 C1137.544312,755.991272 1135.202515,755.991150 1132.860718,755.991272 C1094.368164,755.993469 1055.875244,756.065247 1017.383911,755.852173 C1014.613892,755.836792 1011.326782,754.358459 1009.177124,752.514587 C995.029297,740.379211 981.101624,727.986206 967.154724,715.617981 C957.400635,706.968018 947.789001,698.156921 938.008118,689.537720 C925.055969,678.123962 911.964844,666.868042 899.001526,655.466797 C889.586365,647.186096 880.324097,638.731750 870.917480,630.441223 C857.787354,618.868835 844.568909,607.396790 831.422913,595.842468 C824.989746,590.188232 818.632385,584.447876 812.244751,578.741943 C806.089905,573.243896 800.038086,567.622986 793.707520,562.335632 C792.412292,561.253784 790.081299,561.053894 788.227051,561.051514 C736.737122,560.986206 685.247192,560.999451 633.757202,560.998596 C593.431702,560.997925 553.106140,560.957275 512.780701,561.010620 C492.678223,561.037231 473.943268,555.440857 455.423401,548.183350 C432.934631,539.370422 415.183807,523.986755 397.865814,507.980774 C391.911438,502.477448 386.903381,495.950226 380.396301,488.702698 C384.090332,488.365601 386.105347,488.021179 388.120422,488.020813 C528.093201,487.995514 668.066101,487.925507 808.038330,488.201874 C815.358398,488.216339 820.501282,485.809601 825.379028,481.143066 C839.173523,467.945557 853.002136,454.783508 866.859924,441.652466 C878.190308,430.916290 889.567017,420.228973 900.950012,409.548584 C916.751892,394.722076 932.608582,379.953796 948.385864,365.101196 C961.290039,352.953247 974.087769,340.692291 986.978577,328.530060 C997.484558,318.617798 1008.040283,308.758026 1018.607117,298.910492 C1029.602905,288.663177 1040.530029,278.336853 1051.754028,268.344879 C1053.828491,266.498108 1057.165283,265.161102 1059.931519,265.139618 C1089.229492,264.912262 1118.530151,264.998962 1147.829956,264.999146 C1153.119019,264.999176 1158.408081,264.999176 1163.697144,264.999176 C1163.852051,265.515381 1164.006958,266.031586 1164.161865,266.547791 C1160.775391,269.528046 1157.271240,272.385895 1154.021606,275.508667 C1135.015015,293.773254 1116.088745,312.121216 1097.094727,330.398712 C1080.953125,345.931427 1064.809570,361.462952 1048.569702,376.892700 C1031.281128,393.318817 1013.878235,409.624542 996.271362,426.228027 z"/>
              <path className="stroke stroke-3" d="M345.000366,687.007202 C470.094879,687.007629 594.689575,687.042480 719.284058,686.895020 C724.666504,686.888611 729.070068,687.895630 733.067688,691.514099 C741.515442,699.160706 750.080627,706.679565 758.678772,714.157532 C770.706848,724.618530 782.829712,734.970520 794.867371,745.420532 C798.627869,748.685120 802.243958,752.116089 806.504761,755.998108 C803.197998,755.998108 800.851990,755.998169 798.506042,755.998169 C669.395142,755.998230 540.283447,756.221252 411.173859,755.813354 C384.808563,755.730103 361.736786,745.474304 343.655609,725.947205 C333.712524,715.209045 327.148895,702.343567 325.152435,687.007751 C331.637207,687.007751 338.068848,687.007751 345.000366,687.007202 z"/>
            </svg>
          </div>
        </div>

        <div className="label">
          <div className="word">KODEWAR</div>
          <div className="sub">
            <span>Loading</span>
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loading;
