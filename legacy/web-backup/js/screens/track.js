
const trackOrderData = {
  id: "AR-10432",

  items: "2 × 20L Can",

  steps: [
    {
      label: "Order confirmed",
      time: "2:14 PM",
      status: "done"
    },
    {
      label: "Cans filled & packed",
      time: "2:40 PM",
      status: "done"
    },
    {
      label: "Out for delivery",
      time: "Arriving by 6:30 PM",
      status: "current"
    },
    {
      label: "Delivered",
      time: "",
      status: "upcoming"
    }
  ],

  partner: {
    name: "Murugan",
    vehicle: "Bike · TN 09 AX 4521",
    phone: "+919999999999"
  }
};


function renderTrack(data) {

  const container =
    document.getElementById("track-content");

  if (!container) {
    return;
  }

  container.innerHTML = `
    
    <div class="track-order-info">
      Order #${trackOrderData.id} · ${trackOrderData.items}
    </div>


    <div class="track-timeline">

      ${trackOrderData.steps.map(function(step) {

        let circleContent = "";

        if (step.status === "done") {
          circleContent = `
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
        }

        if (step.status === "current") {
          circleContent = `
            <span class="track-current-dot"></span>
          `;
        }

        return `
          <div class="track-step ${step.status}">

            <div class="track-step-circle">
              ${circleContent}
            </div>

            <div class="track-step-details">

              <div class="track-step-title">
                ${step.label}
              </div>

              ${
                step.time
                  ? `
                    <div class="track-step-time">
                      ${step.time}
                    </div>
                  `
                  : ""
              }

            </div>

          </div>
        `;
      }).join("")}

    </div>


    <!-- ROUTE CARD -->

    <div class="track-route-card">

      <svg
        class="track-route-svg"
        width="100%"
        height="100"
        viewBox="0 0 358 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >

        <path
          class="track-route-path"
          d="M45 70
             C100 82 135 28 190 45
             C235 58 260 18 310 25"
        />

        <circle
          class="track-shop-dot"
          cx="45"
          cy="70"
          r="7"
        />

        <circle
          class="track-customer-dot"
          cx="310"
          cy="25"
          r="7"
        />

        <text
          class="track-map-label"
          x="30"
          y="89"
        >
          Shop
        </text>

        <text
          class="track-map-label"
          x="282"
          y="17"
        >
          You
        </text>

      </svg>

    </div>


    <!-- DELIVERY PARTNER -->

    <div class="track-partner-card">

      <div class="track-partner-avatar">
        ${trackOrderData.partner.name.charAt(0).toUpperCase()}
      </div>

      <div class="track-partner-info">

        <div class="track-partner-name">
          ${trackOrderData.partner.name} · Delivery Partner
        </div>

        <div class="track-partner-vehicle">
          ${trackOrderData.partner.vehicle}
        </div>

      </div>

      <a
        class="track-call-button"
        href="tel:${trackOrderData.partner.phone}"
        aria-label="Call delivery partner"
      >

        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2E9E5B"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M22 16.92v3a2 2 0 0 1-2.18 2
            19.79 19.79 0 0 1-8.63-3.07
            19.5 19.5 0 0 1-6-6
            19.79 19.79 0 0 1-3.07-8.67
            A2 2 0 0 1 4.11 2h3
            a2 2 0 0 1 2 1.72
            12.84 12.84 0 0 0 .7 2.81
            2 2 0 0 1-.45 2.11L8.09 9.91
            a16 16 0 0 0 6 6l1.27-1.27
            a2 2 0 0 1 2.11-.45
            12.84 12.84 0 0 0 2.81.7
            A2 2 0 0 1 22 16.92z"
          />
        </svg>

      </a>

    </div>
  `;
}


window.renderTrack = renderTrack;
