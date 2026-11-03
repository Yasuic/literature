import XCTest

final class GameTests: XCTestCase {
    func testLaunchDealAndResume() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()

        let deal = app.webViews.buttons["Deal"].firstMatch
        if deal.waitForExistence(timeout: 30) {
            let name = app.webViews.textFields.firstMatch
            XCTAssertTrue(name.exists)
            name.tap()
            name.typeText("Player")
            deal.tap()
        }
        let newGame = app.webViews.buttons["New game"].firstMatch
        XCTAssertTrue(newGame.waitForExistence(timeout: 30))
        XCTAssertTrue(app.webViews.staticTexts["Your hand"].firstMatch.waitForExistence(timeout: 30))
        let table = XCTAttachment(screenshot: app.screenshot())
        table.name = "Literature iPhone table"
        table.lifetime = .keepAlways
        add(table)

        // This is the app under test on a disposable cloud simulator.
        app.terminate()
        app.launch()
        XCTAssertTrue(app.webViews.buttons["New game"].firstMatch.waitForExistence(timeout: 30))
        XCTAssertFalse(app.webViews.buttons["Deal"].firstMatch.exists, "A saved deal should resume without a new name prompt")
        XCTAssertTrue(app.webViews.staticTexts["Your hand"].firstMatch.exists)
        let resumed = XCTAttachment(screenshot: app.screenshot())
        resumed.name = "Literature saved game resumed"
        resumed.lifetime = .keepAlways
        add(resumed)
    }
}
