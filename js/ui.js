//Written by Chris H and James S
window.UI = (function () {
  function setStatus(message, type = "") {
    const $status = $("#statusBar");
    $status.removeClass("status--error status--ok");

    if (type === "error") $status.addClass("status--error");
    if (type === "ok") $status.addClass("status--ok");

    $status.text(message || "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getPosterUrl(path) {
    return path
      ? `${Store.config.imageBase}${path}`
      : Store.config.placeholderPoster;
  }

  function movieCard(movie) {
    const title = movie.title || "Untitled";
    const year = movie.release_date ? movie.release_date.slice(0, 4) : "—";
    const rating = typeof movie.vote_average === "number"
      ? movie.vote_average.toFixed(1)
      : "—";

    return `
      <article class="card movie-tile" data-movie-id="${movie.id}">
        <img
          class="poster"
          src="${getPosterUrl(movie.poster_path)}"
          alt="${escapeHtml(title)} poster"
        />
        <div class="card__body">
          <h3 class="card__title">${escapeHtml(title)}</h3>
          <p class="card__meta">${escapeHtml(year)} • ⭐ ${escapeHtml(rating)}</p> 
          <div class="card__actions">
            <button class="btn btn--small js-details-btn" type="button" data-movie-id="${movie.id}">
              Details
            </button>
            <button class="btn btn--small js-favorite-btn" type="button" data-movie-id="${movie.id}">
              + Favorite
            </button>
            <button class="btn btn--small js-watchlist-btn" type="button" data-movie-id="${movie.id}">
              + Watchlist
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function emptyState(message) {
    return `
      <div class="panel">
        <p class="muted">${escapeHtml(message)}</p>
      </div>
    `;
  }

  function renderHomeGrid(data, modeLabel) {
    const $home = $("#viewHome");
    const $title = $home.find(".view__title");
    const $subtitle = $home.find(".view__subtitle");
    const $grid = $home.find(".grid");

    $title.text(modeLabel);

    if (Store.state.homeMode === "search") {
      $subtitle.text(`Showing search results for "${Store.state.homeQuery}"`);
    } else {
      $subtitle.text("Browse popular movies or search for a title using live TMDB data.");
    }

    const results = data?.results || [];
    if (!results.length) {
      $grid.html(emptyState("No movies found."));
      return;
    }

    $grid.html(results.map(movieCard).join(""));
  }

  function renderDiscoverGrid(data) {
    const $discover = $("#viewDiscover");
    const $grid = $discover.find(".grid");
    const $pagerText = $discover.find(".pager__text");

    const results = data?.results || [];
    if (!results.length) {
      $grid.html(emptyState("No discover results found."));
    } else {
      $grid.html(results.map(movieCard).join(""));
    }

    $pagerText.text(`Page ${data.page || 1}`);
  }

  function updateDiscoverControls() {
    $("#genreSelect").val(Store.state.discoverGenre);
    $("#sortSelect").val(Store.state.discoverSort);
  }

  function fillGenreOptions(genres) {
    const $select = $("#genreSelect");
    const currentValue = $select.val();

    $select.html(`<option value="">Any</option>`);

    genres.forEach((genre) => {
      $select.append(
        `<option value="${genre.id}">${escapeHtml(genre.name)}</option>`
      );
    });

    if (Store.state.discoverGenre) {
      $select.val(Store.state.discoverGenre);
    } else if (currentValue) {
      $select.val(currentValue);
    }
  }

  function setActiveView(viewName) {
    $(".view").removeClass("is-active");

    if (viewName === "discover") {
      $("#viewDiscover").addClass("is-active");
    } else if (viewName === "lists") {
      $("#viewLists").addClass("is-active");
    } else if (viewName === "details") {
      $("#viewDetails").addClass("is-active");
    } else {
      $("#viewHome").addClass("is-active");
    }

    $(".nav__link").removeClass("is-active");
    $(`.nav__link[href="#${viewName}"]`).addClass("is-active");
  }

  

  function renderDetailsView(details, credits) {
    const safeDetails = details || {};
    const safeCredits = credits || {};

    const title = safeDetails.title || "Untitled";
    const year = safeDetails.release_date ? String(safeDetails.release_date).slice(0, 4) : "—";
    const rating = (typeof safeDetails.vote_average === "number")
      ? safeDetails.vote_average.toFixed(1)
      : "—";
    const runtime = safeDetails.runtime ? `${safeDetails.runtime} min` : "—";
    const genres = (safeDetails.genres || []).map(function (g) { return g.name; }).join(", ") || "—";
    const overview = safeDetails.overview || "No overview available.";

    const poster = getPosterUrl(safeDetails.poster_path);

    const cast = (safeCredits.cast || []).slice(0, 8);

    const castHtml = cast.length
      ? cast.map(function (p) {
          return `<button class="btn btn--small js-actor-btn" type="button" data-person-id="${p.id}">${escapeHtml(p.name)}</button>`;
        }).join(" ")
      : `<span class="muted">—</span>`;

    $("#viewDetails .view__title").text(`${title} (${year})`);
    $("#viewDetails .view__subtitle").text("Live data loaded from TMDB.");

    $("#detailsBody").html(`
      <div class="two-col">
        <div>
          <img class="poster" src="${poster}" alt="${escapeHtml(title)} poster" />
        </div>
        <div>
          <p><strong>Rating:</strong> ⭐ ${escapeHtml(rating)}</p>
          <p><strong>Runtime:</strong> ${escapeHtml(runtime)}</p>
          <p><strong>Genres:</strong> ${escapeHtml(genres)}</p>
          <p><strong>Overview:</strong><br>${escapeHtml(overview)}</p>
          <p><strong>Top Cast:</strong></p>
          <div class="card__actions">${castHtml}</div>
        </div>
      </div>
    `);
  }

  function openActorModal(person, credits) {
    const safePerson = person || {};
    const safeCredits = credits || {};

    const name = safePerson.name || "Actor";
    //Fix for no actor image
    const profileHtml = safePerson.profile_path
      ? `<img class="poster" src="${getPosterUrl(safePerson.profile_path)}" alt="${escapeHtml(name)} profile" />`
      : `<div class="poster poster--empty" aria-label="No actor image available">No Image</div>`;
    const born = safePerson.birthday || "—";
    const place = safePerson.place_of_birth || "—";
    const bio = safePerson.biography || "No biography available.";

    const knownFor = (safeCredits.cast || [])
      .slice(0, 8)
      .map(function (item) { return escapeHtml(item.title || item.name || ""); })
      .filter(Boolean)
      .join(", ") || "—";

    $("#actorModal .modal__title").text(name);

    $("#actorModal .modal__content").html(`
      <div class="two-col">
        <div>
          ${profileHtml}
        </div>
        <div>
          <p><strong>Born:</strong> ${escapeHtml(born)}</p>
          <p><strong>From:</strong> ${escapeHtml(place)}</p>
          <p><strong>Known For:</strong> ${knownFor}</p>
          <p><strong>Bio:</strong></p>
          <p>${escapeHtml(bio)}</p>
        </div>
      </div>
    `);

    $("#actorModal").addClass("is-open").attr("aria-hidden", "false");
  }

  function closeActorModal() {
    $("#actorModal").removeClass("is-open").attr("aria-hidden", "true");
  }
return {
    setStatus,
    renderHomeGrid,
    renderDiscoverGrid,
    updateDiscoverControls,
    fillGenreOptions,
    setActiveView,
    renderDetailsView,
    openActorModal,
    closeActorModal
  };
})();
