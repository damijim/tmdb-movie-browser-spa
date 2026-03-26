//Written by Chris H and James S
$(function () {
  bindEvents();
  initApp();
});

function bindEvents() {
  $(".nav__link").on("click", function () {
    const targetHash = $(this).attr("href") || "#home";
    const viewName = targetHash.replace("#", "") || "home";
    Store.state.currentView = viewName;
    UI.setActiveView(viewName);
  });

  $(window).on("hashchange", function () {
    const viewName = Router.getViewFromHash();
    Store.state.currentView = viewName;
    UI.setActiveView(viewName);

    if (viewName === "home") {
      loadHome();
    } else if (viewName === "discover") {
      loadDiscover();
    } else if (viewName === "lists") {             //Added lists
      loadMyLists(); 
    } else if (viewName === "details") {
      const movieId = Router.getDetailsIdFromHash();
      loadDetails(movieId);
    }
  });

  $("#searchForm").on("submit", async function (e) {
    e.preventDefault();

    const query = $("#searchInput").val().trim();
    if (!query) {
      UI.setStatus("Please enter a movie title to search.", "error");
      return;
    }

    Store.state.homeMode = "search";
    Store.state.homeQuery = query;
    Store.state.homePage = 1;

    Router.go("home");
    await loadHome();
  });

    // LOGIN BUTTON
  $("#authBtn").on("click", async function () {

    // If already logged in → log out
    if (Store.state.sessionId) {
      logout();
      return;
    }

    try {
      UI.setStatus("Starting TMDB login...");

      const tokenResp = await TMDB.createRequestToken();
      const requestToken = tokenResp.request_token;

      sessionStorage.setItem("tmdb_request_token", requestToken);

      const redirectTo =
        window.location.origin + window.location.pathname + "?tmdb_auth=1";  //Changed #auth to "?tmdb_auth=1"; query string

      const approveUrl =
        `https://www.themoviedb.org/authenticate/${requestToken}?redirect_to=${encodeURIComponent(redirectTo)}`;

      window.location.href = approveUrl;

    } catch (error) {
      console.error(error);
      UI.setStatus("Could not start login.", "error");
    }

  });
  
  // Discover Filters
  $("#sortSelect, #genreSelect").on("change", function () {
    Store.state.discoverGenre = $("#genreSelect").val();
    Store.state.discoverSort = $("#sortSelect").val();
  });

  // Apply button inside Discover filters
  $("#viewDiscover .filters .btn--primary").on("click", async function () {
    Store.state.discoverGenre = $("#genreSelect").val();
    Store.state.discoverSort = $("#sortSelect").val();
    Store.state.discoverPage = 1;

    await loadDiscover();
    UI.setStatus("Discover filters applied.", "ok");
  });

  // Discover pager buttons
  $("#viewDiscover .pager .btn").first().on("click", async function () {
    if (Store.state.discoverPage <= 1) {
      UI.setStatus("You are already on page 1.", "error");
      return;
    }

    Store.state.discoverPage -= 1;
    await loadDiscover();
  });

  $("#viewDiscover .pager .btn").last().on("click", async function () {
    Store.state.discoverPage += 1;
    await loadDiscover();
  });

  // Details button behavior
  $(document).on("click", ".js-details-btn", function () {
    const movieId = $(this).data("movie-id");
    Router.goDetails(movieId);
  });


//Actor modal
  $(document).on("click", ".js-actor-btn", async function () {
    const personId = $(this).data("person-id");
    if (!personId) return;

    try {
      UI.setStatus("Loading actor details...");

      const person = await TMDB.getPersonDetails(personId);

      //Credits are nice to have, but the modal should still work if this call fails
      let credits = null;
      try {
        credits = await TMDB.getPersonCombinedCredits(personId);
      } catch (error) {
        console.warn("Actor credits failed:", error);
      }

      UI.openActorModal(person, credits);
      UI.setStatus("Loaded actor details.", "ok");
    } catch (error) {
      console.error(error);
      UI.setStatus("Could not load actor details.", "error");
    }
  });

  $(document).on(
    "click",
    "#actorModal .modal__backdrop, #actorModal button[aria-label='Close actor modal']",
    function () {
      UI.closeActorModal();
    }
  );
//button handler, will come back for place holder button
  $(document).on("click", ".js-favorite-btn", async function () {
    if (!Store.state.sessionId || !Store.state.accountId) {
      UI.setStatus("Please log in first to add favorites.", "error");
      return;
    }

    const movieId = $(this).data("movie-id");

    try {
      await TMDB.setFavorite(
        Store.state.accountId,
        Store.state.sessionId,
        movieId,
        true
      );

      UI.setStatus("Movie added to Favorites.", "ok");
    } catch (error) {
      console.error(error);
      UI.setStatus("Could not add movie to Favorites.", "error");
    }
  });

  $(document).on("click", ".js-watchlist-btn", async function () {
    if (!Store.state.sessionId || !Store.state.accountId) {
      UI.setStatus("Please log in first to add to Watchlist.", "error");
      return;
    }

    const movieId = $(this).data("movie-id");

    try {
      await TMDB.setWatchlist(
        Store.state.accountId,
        Store.state.sessionId,
        movieId,
        true
      );

      UI.setStatus("Movie added to Watchlist.", "ok");
    } catch (error) {
      console.error(error);
      UI.setStatus("Could not add movie to Watchlist.", "error");
    }
  });

  //Remove button to remove from favorites and watchlist
  $(document).on("click", ".js-remove-btn", async function () {
    if (!Store.state.sessionId || !Store.state.accountId) {
      UI.setStatus("Please log in first to update your lists.", "error");
      return;
    }

    const movieId = $(this).data("movie-id");
    const listType = $(this).data("list-type");

    try {
      if (listType === "favorite") {
        await TMDB.setFavorite(
            Store.state.accountId,
            Store.state.sessionId,
            movieId,
            false
        );
        UI.setStatus("Movie removed from Favorites.", "ok");
      } else if (listType === "watchlist") {
        await TMDB.setWatchlist(
            Store.state.accountId,
            Store.state.sessionId,
            movieId,
            false
        );
        UI.setStatus("Movie removed from Watchlist.", "ok");
      }

      await loadMyLists(true); //Fix for the status message of "Removed movie", allowing page to update w/o the status message
    } catch (error) {
      console.error(error);
      UI.setStatus("Could not remove movie from your list.", "error");
    }
  });

  $("#detailsBackBtn").on("click", function () {
    Router.go("home");
  });

}

async function initApp() {
  updateAuthButton(); //Added button auth
  UI.setActiveView(Router.getViewFromHash());

  try {
    await finishLoginIfReturningFromTMDB();  //Call auth setup
    await loadGenres();

    const currentView = Router.getViewFromHash();
    if (currentView === "discover") {
      await loadDiscover();
    } else if (currentView === "lists") {
      await loadMyLists();
    } else if (currentView === "details") {
      const movieId = Router.getDetailsIdFromHash();
      await loadDetails(movieId);
    } else {
      await loadHome();
    }
  } catch (error) {
    console.error(error);
    UI.setStatus("App failed to initialize. Check your TMDB API key.", "error");
  }
}

async function loadGenres() {
  if (Store.state.genresLoaded) return;

  try {
    const data = await TMDB.getGenres();
    Store.state.genres = data.genres || [];
    Store.state.genresLoaded = true;
    UI.fillGenreOptions(Store.state.genres);
    UI.updateDiscoverControls();
  } catch (error) {
    console.error(error);
    UI.setStatus("Could not load genres.", "error");
  }
}

async function loadHome() {
  try {
    UI.setStatus("Loading movies...");

    let data;
    if (Store.state.homeMode === "search" && Store.state.homeQuery) {
      data = await TMDB.searchMovies(Store.state.homeQuery, Store.state.homePage);
      UI.renderHomeGrid(data, "Search Results");
      UI.setStatus(`Loaded search results for "${Store.state.homeQuery}".`, "ok");
    } else {
      data = await TMDB.getPopularMovies(Store.state.homePage);
      UI.renderHomeGrid(data, "Popular Right Now");
      UI.setStatus("Loaded popular movies.", "ok");
    }
  } catch (error) {
    console.error(error);
    UI.setStatus("Could not load Home movies.", "error");
  }
}

async function loadDiscover() {
  try {
    UI.setStatus("Loading discover results...");
    UI.updateDiscoverControls();

    const data = await TMDB.discoverMovies({
      genre: Store.state.discoverGenre,
      sort: Store.state.discoverSort,
      page: Store.state.discoverPage
    });

    UI.renderDiscoverGrid(data);
    UI.setStatus("Loaded discover results.", "ok");
  } catch (error) {
    console.error(error);
    UI.setStatus("Could not load Discover results.", "error");
  }
}

async function loadMyLists(skipStatusMessage = false) {
  if (!Store.state.sessionId || !Store.state.accountId) {
    $("#viewLists .panel").first().html(`
      <h3 class="panel__title">Favorites</h3>
      <p class="muted">Please log in to view Favorites.</p>
    `);

    $("#viewLists .panel").last().html(`
      <h3 class="panel__title">Watchlist</h3>
      <p class="muted">Please log in to view Watchlist.</p>
    `);

    UI.setStatus("Please log in to view your lists.", "error");
    return;
  }

  try {
    if (!skipStatusMessage) {
      UI.setStatus("Loading your lists...");
    }

    const [favoritesData, watchlistData] = await Promise.all([
      TMDB.getFavoriteMovies(Store.state.accountId, Store.state.sessionId, 1),
      TMDB.getWatchlistMovies(Store.state.accountId, Store.state.sessionId, 1)
    ]);

    renderMyLists(favoritesData.results || [], watchlistData.results || []);
    if (!skipStatusMessage) {
      UI.setStatus("Loaded your Favorites and Watchlist.", "ok");
    }
  } catch (error) {
    console.error(error);
    UI.setStatus("Could not load your lists.", "error");
  }
}

function renderMyLists(favorites, watchlist) {
  const favoritesHtml = favorites.length
      ? favorites.map(function (movie) {
        return renderListItemCard(movie, "favorite");
      }).join("")
      : `<p class="muted">No favorites yet.</p>`;

  const watchlistHtml = watchlist.length
      ? watchlist.map(function (movie) {
        return renderListItemCard(movie, "watchlist");
      }).join("")
      : `<p class="muted">No watchlist items yet.</p>`;

  $("#viewLists .panel").first().html(`
    <h3 class="panel__title">Favorites</h3>
    <div class="grid">${favoritesHtml}</div>
  `);

  $("#viewLists .panel").last().html(`
    <h3 class="panel__title">Watchlist</h3>
    <div class="grid">${watchlistHtml}</div>
  `);
}

function renderListItemCard(movie, listType) {
  const title = movie.title || "Untitled";
  const year = movie.release_date ? movie.release_date.slice(0, 4) : "—";
  const rating = typeof movie.vote_average === "number"
    ? movie.vote_average.toFixed(1)
    : "—";

  const poster = movie.poster_path
    ? `${Store.config.imageBase}${movie.poster_path}`
    : Store.config.placeholderPoster;

  return `
    <article class="card movie-tile" data-movie-id="${movie.id}">
      <img
        class="poster"
        src="${poster}"
        alt="${title} poster"
      />
      <div class="card__body">
        <h3 class="card__title">${title}</h3>
        <p class="card__meta">${year} • ⭐ ${rating}</p>
        <div class="card__actions">
          <button class="btn btn--small js-remove-btn" type="button" data-movie-id="${movie.id}" data-list-type="${listType}">
            Remove
          </button>
        </div>
      </div>
    </article>
  `;
}

function updateAuthButton() {
  if (Store.state.sessionId) {
    $("#authBtn").text("Log out");
  } else {
    $("#authBtn").text("Log in");
  }
}

function logout() {
  Store.state.sessionId = "";
  Store.state.accountId = "";

  localStorage.removeItem("tmdb_session_id");
  localStorage.removeItem("tmdb_account_id");
  sessionStorage.removeItem("tmdb_request_token");

  updateAuthButton();
  UI.setStatus("Logged out.", "ok");
  Router.go("home");
}


async function loadDetails(movieId) {
  if (!movieId) {
    UI.setStatus("No movie selected.", "error");
    return;
  }

  try {
    UI.setStatus("Loading movie details...");

    const [details, credits] = await Promise.all([
      TMDB.getMovieDetails(movieId),
      TMDB.getMovieCredits(movieId)
    ]);

    UI.setActiveView("details");
    UI.renderDetailsView(details, credits);
    UI.setStatus("Loaded movie details.", "ok");
  } catch (error) {
    console.error(error);
    UI.setStatus("Could not load movie details.", "error");
  }
}

async function finishLoginIfReturningFromTMDB() {
  const params = new URLSearchParams(window.location.search);
  const isReturningFromTMDB = params.get("tmdb_auth") === "1";
  const approved = params.get("approved");
  const returnedToken = params.get("request_token");

  if (!isReturningFromTMDB) return;

  if (approved !== "true") {
    UI.setStatus("TMDB login was not approved.", "error");
    window.history.replaceState({}, document.title, window.location.pathname + "#home");
    return;
  }

  const token = returnedToken || sessionStorage.getItem("tmdb_request_token");
  if (!token) {
    UI.setStatus("Missing request token. Please click Log in again.", "error");
    window.history.replaceState({}, document.title, window.location.pathname + "#home");
    return;
  }

  try {
    UI.setStatus("Finishing TMDB login...");

    const sessionResp = await TMDB.createSession(token);
    const sessionId = sessionResp.session_id;

    Store.state.sessionId = sessionId;
    localStorage.setItem("tmdb_session_id", sessionId);

    const account = await TMDB.getAccount(sessionId);
    Store.state.accountId = String(account.id);
    localStorage.setItem("tmdb_account_id", String(account.id));

    sessionStorage.removeItem("tmdb_request_token");

    updateAuthButton();
    UI.setStatus("Logged in successfully.", "ok");

    window.history.replaceState({}, document.title, window.location.pathname + "#lists");
    UI.setActiveView("lists");
  } catch (error) {
    console.error(error);
    UI.setStatus("Could not complete login.", "error");
    window.history.replaceState({}, document.title, window.location.pathname + "#home");
  }
}
