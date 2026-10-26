package com.mybrothar.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

/**
 * MyBrothar — cliente Android.
 * Es una WebView ligera que se conecta al servidor MyBrothar del PC por WiFi.
 * El servidor (ZIP de Releases) corre en el PC; esta app solo muestra el juego.
 */
public class MainActivity extends Activity {

  private static final String PREFS = "mybrothar";
  private static final String KEY_URL = "url";
  private static final String BG = "#171214";
  private static final int TEXT_SOFT = 0xffc9bdb8;

  private WebView web;
  private LinearLayout formView;
  private LinearLayout errorView;
  private TextView errorUrl;
  private EditText input;
  private SharedPreferences prefs;
  private String currentUrl;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    getWindow().setStatusBarColor(Color.parseColor(BG));
    getWindow().setNavigationBarColor(Color.parseColor(BG));

    web = new WebView(this);
    web.setBackgroundColor(Color.parseColor(BG));
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setLoadWithOverviewMode(true);
    s.setUseWideViewPort(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setSupportZoom(false);
    s.setBuiltInZoomControls(false);
    web.setWebViewClient(new MyClient());
    web.setWebChromeClient(new WebChromeClient());

    formView = buildForm();
    errorView = buildError();

    setContentView(web);
    if (savedInstanceState != null) {
      web.restoreState(savedInstanceState);
      currentUrl = prefs.getString(KEY_URL, null);
    } else {
      String saved = prefs.getString(KEY_URL, null);
      if (saved == null || saved.length() == 0) {
        showForm("");
      } else {
        currentUrl = saved;
        web.loadUrl(saved);
      }
    }
  }

  private void load(String url) {
    currentUrl = url;
    prefs.edit().putString(KEY_URL, url).apply();
    setContentView(web);
    web.loadUrl(url);
  }

  private void showForm(String value) {
    input.setText(value == null ? "" : value);
    setContentView(formView);
  }

  private void showError(String url) {
    errorUrl.setText(url == null ? "" : url);
    setContentView(errorView);
  }

  private int px(int dp) {
    return Math.round(dp * getResources().getDisplayMetrics().density);
  }

  private LinearLayout buildForm() {
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setBackgroundColor(Color.parseColor(BG));
    root.setPadding(px(28), px(28), px(28), px(28));

    TextView title = new TextView(this);
    title.setText("\uD83C\uDFB2 MyBrothar");
    title.setTextSize(28);
    title.setTextColor(Color.WHITE);
    title.setGravity(Gravity.CENTER);

    TextView hint = new TextView(this);
    hint.setText("Arranca MyBrothar en tu PC y escribe aquí la dirección que muestra el botón morado \"Probar en el móvil\" (misma WiFi).\n\nEjemplo: http://192.168.1.40:3000");
    hint.setTextSize(15);
    hint.setTextColor(TEXT_SOFT);
    hint.setPadding(0, px(14), 0, px(24));

    input = new EditText(this);
    input.setHint("http://192.168.1.40:3000");
    input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
    input.setSingleLine(true);
    input.setTextColor(Color.WHITE);
    input.setHintTextColor(0xff8a7f7a);

    Button go = new Button(this);
    go.setText("Conectar");
    go.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        String u = input.getText().toString().trim();
        if (!u.startsWith("http://") && !u.startsWith("https://")) {
          u = "http://" + u;
        }
        if (u.length() < 12 || (!u.contains(".") && !u.contains(":"))) {
          Toast.makeText(MainActivity.this, "Dirección no válida", Toast.LENGTH_SHORT).show();
          return;
        }
        load(u);
      }
    });

    root.addView(title);
    root.addView(hint);
    root.addView(input);
    root.addView(go);
    return root;
  }

  private LinearLayout buildError() {
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setBackgroundColor(Color.parseColor(BG));
    root.setPadding(px(28), px(28), px(28), px(28));

    TextView title = new TextView(this);
    title.setText("No se pudo conectar");
    title.setTextSize(22);
    title.setTextColor(Color.WHITE);
    title.setGravity(Gravity.CENTER);

    errorUrl = new TextView(this);
    errorUrl.setTextSize(14);
    errorUrl.setTextColor(TEXT_SOFT);
    errorUrl.setGravity(Gravity.CENTER);
    errorUrl.setPadding(0, px(14), 0, px(8));

    TextView tip = new TextView(this);
    tip.setText("Comprueba que el servidor está arrancado en el PC y que el móvil está en la misma WiFi.");
    tip.setTextSize(14);
    tip.setTextColor(TEXT_SOFT);
    tip.setGravity(Gravity.CENTER);
    tip.setPadding(0, 0, 0, px(20));

    Button retry = new Button(this);
    retry.setText("Reintentar");
    retry.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        if (currentUrl != null) {
          setContentView(web);
          web.loadUrl(currentUrl);
        } else {
          showForm("");
        }
      }
    });

    Button change = new Button(this);
    change.setText("Cambiar dirección");
    change.setOnClickListener(new View.OnClickListener() {
      @Override
      public void onClick(View v) {
        showForm(currentUrl);
      }
    });

    root.addView(title);
    root.addView(errorUrl);
    root.addView(tip);
    root.addView(retry);
    root.addView(change);
    return root;
  }

  private class MyClient extends WebViewClient {
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
      return false;
    }

    @Override
    public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
      currentUrl = url;
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
      if (request != null && request.isForMainFrame()) {
        showError(currentUrl);
      }
    }
  }

  @Override
  public boolean onKeyDown(int keyCode, KeyEvent event) {
    if (keyCode == KeyEvent.KEYCODE_BACK && web.getParent() != null && web.canGoBack()) {
      web.goBack();
      return true;
    }
    return super.onKeyDown(keyCode, event);
  }

  @Override
  protected void onSaveInstanceState(Bundle outState) {
    super.onSaveInstanceState(outState);
    web.saveState(outState);
  }
}
