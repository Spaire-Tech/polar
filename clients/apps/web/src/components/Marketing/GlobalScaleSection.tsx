export default function GlobalScaleSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Diagonal transition */}
      <div className="absolute top-0 left-0 h-[200px] w-full bg-white">
        <div
          className="absolute bottom-0 left-0 h-[200px] w-full"
          style={{
            background: 'linear-gradient(170deg, transparent 40%, #0a2540 40.1%)',
          }}
        />
      </div>

      {/* Dark background */}
      <div className="bg-[#0a2540] pt-[200px] pb-24">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
            {/* Left: Copy */}
            <div>
              <p className="mb-3 text-[15px] font-semibold text-[#00d4aa]">
                Global scale
              </p>
              <h2 className="text-[34px] leading-[1.15] font-semibold tracking-tight text-white sm:text-[44px]">
                The backbone for global software commerce
              </h2>
              <p className="mt-5 max-w-[480px] text-[17px] leading-relaxed text-[#8898aa]">
                Spaire makes selling software and digital products as easy and
                programmable as deploying code. Our teams handle tax compliance
                across every jurisdiction so you can sell to customers around the
                world from day one.
              </p>
            </div>

            {/* Right: World map */}
            <div className="relative h-[300px]">
              {/* Simplified world map with dots */}
              <svg
                viewBox="0 0 500 300"
                className="h-full w-full opacity-30"
                fill="none"
              >
                {/* Grid lines */}
                {[...Array(7)].map((_, i) => (
                  <line
                    key={`h${i}`}
                    x1="0"
                    y1={i * 50}
                    x2="500"
                    y2={i * 50}
                    stroke="#1a3a5c"
                    strokeWidth="0.5"
                  />
                ))}
                {[...Array(11)].map((_, i) => (
                  <line
                    key={`v${i}`}
                    x1={i * 50}
                    y1="0"
                    x2={i * 50}
                    y2="300"
                    stroke="#1a3a5c"
                    strokeWidth="0.5"
                  />
                ))}
              </svg>

              {/* Connection dots */}
              {[
                { x: '20%', y: '35%', color: '#ff6ec7', size: 8 },
                { x: '25%', y: '55%', color: '#635bff', size: 6 },
                { x: '48%', y: '30%', color: '#00d4aa', size: 8 },
                { x: '52%', y: '45%', color: '#ff6ec7', size: 6 },
                { x: '70%', y: '35%', color: '#f7ce68', size: 8 },
                { x: '75%', y: '55%', color: '#635bff', size: 6 },
                { x: '85%', y: '70%', color: '#00d4aa', size: 6 },
              ].map((dot, i) => (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    left: dot.x,
                    top: dot.y,
                    width: dot.size,
                    height: dot.size,
                    backgroundColor: dot.color,
                    boxShadow: `0 0 12px ${dot.color}`,
                  }}
                />
              ))}

              {/* Connection lines */}
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M20,35 Q35,25 48,30"
                  stroke="#ff6ec7"
                  strokeWidth="0.3"
                  fill="none"
                  opacity="0.6"
                />
                <path
                  d="M48,30 Q60,28 70,35"
                  stroke="#00d4aa"
                  strokeWidth="0.3"
                  fill="none"
                  opacity="0.6"
                />
                <path
                  d="M52,45 Q63,50 75,55"
                  stroke="#635bff"
                  strokeWidth="0.3"
                  fill="none"
                  opacity="0.6"
                />
                <path
                  d="M70,35 Q78,45 85,70"
                  stroke="#f7ce68"
                  strokeWidth="0.3"
                  fill="none"
                  opacity="0.6"
                />
              </svg>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-16 grid grid-cols-2 gap-8 lg:grid-cols-4">
            {[
              { value: '36+', desc: 'currencies and payment methods supported.' },
              { value: '99.9%', desc: 'historical uptime for Spaire services.' },
              { value: '100+', desc: 'countries covered by merchant of record.' },
              { value: '135+', desc: 'tax jurisdictions where Spaire collects and remits.' },
            ].map((stat) => (
              <div key={stat.value} className="border-l-2 border-[#635bff] pl-4">
                <p className="text-[28px] font-semibold text-white">
                  {stat.value}
                </p>
                <p className="mt-1 text-[14px] text-[#8898aa]">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
