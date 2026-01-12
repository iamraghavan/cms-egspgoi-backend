# Flutter Leads Module Guide
**Role-Based Features & Implementation Strategy**

## 1. Role-Based Feature Matrix
Before coding, ensure your UI adapts to the user's role stored in `authProvider`.

| Feature | Executive | Admission Manager | Super Admin |
| :--- | :---: | :---: | :---: |
| **View Leads** | Own Only | Team + Own | All Leads |
| **Create Lead** | ✅ | ✅ | ✅ |
| **Edit Details** | ✅ | ✅ | ✅ |
| **Change Status** | ✅ | ✅ | ✅ |
| **Initiate Call** | ✅ | ✅ | ✅ |
| **Transfer Lead** | ❌ (Hide Button) | ✅ | ✅ |
| **Bulk Actions** | ❌ | ✅ | ✅ |
| **Delete (Hard)** | ❌ | ❌ | ✅ |
| **Export** | ✅ (Own Data) | ✅ | ✅ |

---

## 2. State Management (Riverpod)
Use a specific `LeadsNotifier` to handle list logic separate from Authentication.

### `leads_provider.dart`
```dart
final leadsProvider = StateNotifierProvider<LeadsNotifier, AsyncValue<List<Lead>>>((ref) {
  return LeadsNotifier(ref.read(apiProvider));
});

class LeadsNotifier extends StateNotifier<AsyncValue<List<Lead>>> {
  final ApiService _api;
  int _page = 1;
  bool _hasMore = true;

  LeadsNotifier(this._api) : super(const AsyncValue.loading()) {
    fetchLeads();
  }

  Future<void> fetchLeads({bool refresh = false}) async {
    if (refresh) {
      _page = 1;
      _hasMore = true;
      state = const AsyncValue.loading();
    }
    
    // ... Call API: GET /leads?limit=20&cursor=...
    // Update state
  }
}
```

---

## 3. UI Implementation Patterns

### A. Infinite Scroll List (The Feed)
-   **Widget**: `PagedListView` (from `infinite_scroll_pagination` package).
-   **Card Design**:
    -   **Leading**: Avatar or Initials.
    -   **Title**: Lead Name.
    -   **Subtitle**: Course + Status Badge.
    -   **Trailing**: "Call" Icon Button (Green).
-   **Interactions**:
    -   **Tap**: Open `LeadDetailScreen`.
    -   **Swipe Left**: "Quick Status Change" (e.g., set to 'Follow Up').

### B. Lead Detail Screen (The Hub)
Organize into Tabs:
1.  **Overview**: Basic Info (Phone, Email, Source).
2.  **Timeline**: List of Notes (`GET /leads/:id/notes`) & Call Logs.
3.  **Actions**:
    -   **Wait for Action Floating Button**: "Add Note".
    -   **Top Bar**: "Transfer" icon (Only show if `user.role != 'Executive'`).

### C. Smartflo Call Flow (Critical)
1.  **User Taps Call**:
    -   Show Dialog: "Connecting to Cloud Telephony...".
    -   API: `POST /leads/:id/call`.
2.  **On Success**:
    -   Show **Overlay/Banner**: "Calling [Name]...".
    -   Start **Polling**: `GET /smartflo/active-call/:id` every 2s.
3.  **On Answer**:
    -   Change Overlay to "Connected (00:01)".
    -   Show "Add Discovery Note" button immediately.

---

## 4. Offline Synchronization (Field Agents)
For Executives who travel:
1.  **Local Storage**: Use **Hive** to replicate the `leads` list locally.
2.  **Logic**:
    -   `init()`: Load from Hive first (Instant UI). Then fetch API background (Network First strategy).
    -   `addLead()` (Offline): Save to `leads_sync_queue` Box.
    -   **Background Worker**: When `ConnectivityResult != none`:
        -   Loop through `leads_sync_queue`.
        -   POST to server.
        -   On 201 Created: Remove from queue & update local Hive list.

---

## 5. Security & Validation
-   **Input Validation**: Use `flutter_form_builder` for the "Add Lead" form.
    -   Phone: Regex `^[0-9]{10}$`.
    -   Email: `Validators.email`.
-   **Error Handling**:
    -   If `Transfer` API returns 403 (Forbidden), show Snackbar: "You don't have permission to transfer." (This handles cases where UI logic might lag behind Backend RBAC).
