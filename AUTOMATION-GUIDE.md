# 🎮 Browser Automation Guide

## 🎯 **What's New**

Cursor Browser Inspector now includes **browser automation tools** that let Cursor AI:
- 🕹️ Control the browser (click, type, navigate)
- 👀 Inspect page structure (HTML, DOM)
- 📸 Capture screenshots for verification
- 🧪 Test features automatically
- 🐛 Debug by reproducing issues

**The AI has full browser control through simple primitives!**

---

## ⚡ **The 4 Automation Tools**

### **1. `execute_javascript`** - Do Anything
**Purpose**: Run any JavaScript code in the browser page context.

**Parameters**:
- `code` (required): JavaScript code to execute
- `return_value` (optional, default: true): Whether to return the result

**What AI can do with this**:
- Click elements: `document.querySelector('#button').click()`
- Fill forms: `document.querySelector('#email').value = 'test@test.com'`
- Navigate: `window.location.href = '/dashboard'`
- Read state: `document.querySelector('#username').textContent`
- Trigger events: `document.querySelector('#btn').dispatchEvent(new Event('click'))`
- **Anything JavaScript can do!**

### **2. `get_page_html`** - See Everything
**Purpose**: Get the HTML content of the page or a specific element.

**Parameters**:
- `selector` (optional): CSS selector for specific element

**What AI can do with this**:
- Understand page structure
- Find element selectors
- Verify content exists
- Analyze DOM structure
- Find forms, buttons, inputs

### **3. `capture_screenshot`** - Visual Verification
**Purpose**: Take a screenshot of the current page state.

**Parameters**:
- `full_page` (optional, default: false): Capture full scrollable page

**What AI can do with this**:
- Verify visual changes
- Debug layout issues
- Confirm feature appearance
- Create visual test evidence
- **AI can analyze the screenshot** to verify success

### **4. `get_page_info`** - Know Where You Are
**Purpose**: Get current page metadata and state.

**Returns**: URL, title, ready state, dimensions, scroll position

**What AI can do with this**:
- Verify navigation worked
- Check page loaded correctly
- Understand current context
- Track page changes

---

## 🎬 **Real-World Automation Examples**

### **Example 1: Test Login Flow**
```
You: "Test if the login works"

Cursor AI:
1. get_page_html({ selector: "#login-form" })
   → Finds email and password inputs, login button

2. execute_javascript({ code: "document.querySelector('#email').value = 'test@example.com'" })
   → Fills email field

3. execute_javascript({ code: "document.querySelector('#password').value = 'test123'" })
   → Fills password field

4. execute_javascript({ code: "document.querySelector('#login-button').click()" })
   → Clicks login button

5. Wait 2 seconds (AI can execute: await new Promise(r => setTimeout(r, 2000)))

6. get_console_logs({ type: "error" })
   → Checks for errors

7. get_network_requests({ url_pattern: "login" })
   → Verifies API call worked

8. capture_screenshot()
   → Takes screenshot of result

9. get_page_info()
   → Confirms navigation to /dashboard

Cursor: "✅ Login successful! User redirected to /dashboard, 
API returned 200, no errors. Screenshot shows dashboard loaded."
```

### **Example 2: Debug a Button That Doesn't Work**
```
You: "The submit button isn't working"

Cursor AI:
1. get_page_html({ selector: "button" })
   → Finds all buttons on page

2. execute_javascript({ code: "Array.from(document.querySelectorAll('button')).map(b => ({id: b.id, class: b.className, text: b.textContent}))" })
   → Lists all buttons

3. execute_javascript({ code: "document.querySelector('#submit-btn').click()" })
   → Tries to click the submit button

4. get_console_logs({ type: "error" })
   → Finds error: "Cannot read property 'email' of undefined"

5. get_page_html({ selector: "#submit-btn" })
   → Inspects the button and surrounding code

Cursor: "The submit button exists but clicking it causes an error. 
The form is trying to access 'formData.email' but formData is undefined. 
You need to initialize formData before the submit handler runs."
```

### **Example 3: Verify Feature After Code Change**
```
You: "I just added a new dashboard widget. Can you verify it works?"

Cursor AI:
1. get_page_info()
   → Confirms on /dashboard page

2. get_page_html({ selector: ".dashboard-widgets" })
   → Finds the widgets container

3. execute_javascript({ code: "document.querySelectorAll('.widget').length" })
   → Counts widgets (returns: 5)

4. execute_javascript({ code: "document.querySelector('.widget:last-child').textContent" })
   → Gets the new widget's text

5. capture_screenshot()
   → Visual verification

6. get_console_logs({ limit: 10 })
   → Checks for any errors during render

Cursor: "✅ New widget is visible! It's the 5th widget showing 
'Sales Overview'. No console errors. Screenshot shows it renders 
correctly in the dashboard grid."
```

### **Example 4: Fill and Submit a Form**
```
You: "Fill out the contact form with test data and submit it"

Cursor AI:
1. get_page_html({ selector: "form" })
   → Finds form structure

2. execute_javascript({ code: `
     document.querySelector('#name').value = 'John Doe';
     document.querySelector('#email').value = 'john@example.com';
     document.querySelector('#message').value = 'Test message';
   `})
   → Fills all fields

3. execute_javascript({ code: "document.querySelector('form').submit()" })
   → Submits form

4. get_network_requests({ url_pattern: "contact" })
   → Verifies form submission API call

5. get_console_logs()
   → Checks for success/error messages

Cursor: "✅ Form submitted successfully! POST /api/contact 
returned 200 OK. Console shows 'Message sent successfully'."
```

---

## 💡 **Why This Approach is Brilliant**

### **Instead of Building 50 Specific Tools:**
- `click_button({ selector })`
- `fill_input({ selector, value })`
- `submit_form({ selector })`
- `navigate_to({ url })`
- `wait_for_element({ selector })`
- ... and 45 more specific tools

### **We Give AI 4 Powerful Primitives:**
- `execute_javascript({ code })` - **Do ANYTHING**
- `get_page_html({ selector })` - **See EVERYTHING**
- `capture_screenshot()` - **Verify visually**
- `get_page_info()` - **Know where you are**

**The AI figures out the rest!**

### **Benefits:**
- ✅ Simpler to implement (4 tools vs 50)
- ✅ More flexible (AI not constrained by our workflows)
- ✅ More powerful (AI can do things we didn't anticipate)
- ✅ Less maintenance (no specific workflow logic to update)
- ✅ Future-proof (works with any web app, any framework)

---

## 🧪 **Testing Automation Features**

### **Quick Test:**
1. Run: `CDP: Open Chrome With Cursor Connection`
2. Open your web app in debug Chrome
3. Ask Cursor: "What buttons are on this page?"

**Expected**: Cursor uses `get_page_html` or `execute_javascript` to list all buttons.

### **Advanced Test:**
1. Ask: "Click the login button and tell me what happens"
2. **Expected**: Cursor uses `execute_javascript` to click and checks console/network
3. Ask: "Take a screenshot of the current page"
4. **Expected**: Cursor uses `capture_screenshot` and describes what it sees

---

## 🎯 **What AI Can Now Do**

### **Testing & Verification:**
- Test user flows (login, signup, checkout)
- Verify features work after code changes
- Reproduce bugs by following steps
- Create visual evidence (screenshots)

### **Debugging:**
- Click elements to trigger errors
- Fill forms to test validation
- Navigate through app to find issues
- Inspect DOM to find selector problems

### **Exploration:**
- Discover page structure
- List available interactive elements
- Read current state/data
- Understand app flow

---

## 🔐 **Safety**

### **Automatic Safety Measures:**
- ✅ Only affects the debug Chrome instance (separate profile)
- ✅ Only connected to localhost tabs by default
- ✅ All actions visible in console logs
- ✅ No persistent changes (refresh to reset)

### **User Control:**
- User initiates all automation via questions to Cursor
- User can see all JavaScript being executed
- User can stop connection anytime
- Isolated browser instance

---

## 💬 **Sample Questions to Try**

### **Testing Questions:**
- "Test if the login form works"
- "Click the save button and see what happens"
- "Fill out the signup form with test data"
- "Navigate to the profile page and take a screenshot"

### **Debugging Questions:**
- "Why doesn't this button work? Try clicking it"
- "What happens when I submit this form?"
- "Can you see the error message on the page?"
- "Show me all the buttons on this page"

### **Verification Questions:**
- "Does the new feature I added show up on the page?"
- "Take a screenshot and verify the layout looks correct"
- "Is there any text on the page that says 'success'?"
- "What's the current page URL after clicking login?"

---

## 🚀 **What This Unlocks**

### **Self-Debugging AI:**
Cursor can now:
1. **Reproduce issues** by following user steps
2. **Test features** after making code changes
3. **Verify fixes** by running through scenarios
4. **Provide visual proof** via screenshots
5. **Explore the app** to understand context

### **AI-Powered Testing:**
- Cursor can test user flows autonomously
- Cursor can verify features work
- Cursor can create test evidence
- Cursor can find edge cases

### **Enhanced Debugging:**
- Cursor can trigger bugs to understand them
- Cursor can test hypotheses by trying things
- Cursor can navigate to problem areas
- Cursor can inspect live state

---

## 🎉 **Summary**

**Before**: Cursor could only observe (logs, network)
**After**: Cursor can observe AND control (full browser access)

**Result**: Cursor AI becomes a true debugging partner that can:
- Read your code
- See what's in the browser
- Execute actions to test
- Verify results visually
- Provide comprehensive feedback

**It's like pair programming with an AI that can use your browser!** 🤖👨‍💻

---

**Try it now: Ask Cursor to test something in your app!** 🚀


