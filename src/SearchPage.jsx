import * as React from "react";
import * as _ from "lodash";
import {getS3Bucket,downloadObject,uploadObject,deleteObjectS3AndES} from "./AWSSetup";

import {
	SearchkitManager, SearchkitProvider,
	SearchBox, RefinementListFilter, MenuFilter,
	Hits, HitsStats, NoHits, Pagination, SortingSelector,
	SelectedFilters, ResetFilters, ItemHistogramList,
	Layout, LayoutBody, LayoutResults, TopBar,
	SideBar, ActionBar, ActionBarRow
} from "searchkit";

require("./index.scss");

const host = "http://search-dev-task-search-cluster-ric5clhuvao44dtnhhhlnje7o4.us-west-2.es.amazonaws.com"
const searchkit = new SearchkitManager(host)

var bucket = getS3Bucket();

const FileListItem = (props)=> {
  const {bemBlocks, result} = props
  const source:any = _.extend({}, result._source, result.highlight)
  var bucket = getS3Bucket();
  let url = "https://s3-us-west-2.amazonaws.com/" 
          + encodeURIComponent(source.Bucket) 
          + "/" 
          + encodeURIComponent(source.Key)
  if(result.highlight) {
          var highlights = source.Text
                  .map((highlight) => "<li>" + highlight + "</li>")
                  .join("")
                  .replace(/\n/,"")
                  .replace(/\<em\>/g,"<span class='highlighted'>")
                  .replace(/\<\/em\>/g,"</span>");
  } else {
          var highlights = ""
  }
  return (
                  <div>
                          <DeleteButton Key={source.Key}/>
                          <div className="downloadable" onClick={()=>downloadObject(bucket,source.Key)}>
                                  <h4>{source.Key}</h4> 
                                  <ul dangerouslySetInnerHTML={{__html:highlights}}></ul>
                          </div>
                  </div>
          );
}
class S3Controls extends React.Component {
        render() {
                return (
                                <div id="controls">
                                <UploadUI/>
                                <RefreshButton/>
                                </div>
                       )
        }
}
class RefreshButton extends React.Component {
        constructor(props) {
                super(props);
        }
        handleClick() {
                searchkit.reloadSearch();
        }
        render() {
                return (
                                <div id="refresh">
                                <div className="clickable"  onClick={()=>this.handleClick()}> Refresh </div>
                                </div>
                       )
        }
}
class DeleteButton extends React.Component {
        executeDelete() {
                console.log("Deleted " + this.props.Key);
                var deletePromise = deleteObjectS3AndES(bucket,this.props.Key);
                this.refs.deleteWindow.await(deletePromise);
                var self = this;
                deletePromise.then(function() {
                        self.refs.deleteWindow.close();
                        self.refs.messageDeleted.display();
                        searchkit.reloadSearch();
                });
        }
        render() {
                return (
                                <div className="delete-button">
                                        <Message className="delete" duration={3000} ref="messageDeleted"> Deleted! </Message>
                                        <div className="clickable" onClick={()=>this.refs.deleteWindow.open()}>Delete</div>
                                        <Window title={"Delete " + this.props.Key} ref="deleteWindow">
                                                <button onClick={()=>this.refs.deleteWindow.close()}>Cancel</button>
                                                <button className="delete-button-confirm" onClick={()=>this.executeDelete()}> Delete </button>
                                        </Window>
                                </div>
                       )
        }
}
class UploadUI extends React.Component {
        constructor(props) {
                super(props);
                this.state = {
                        clicked: false,
                };
        }
        handleClick() {
                this.refs.uploadWindow.open();
                this.setState({clicked:!this.state.clicked});
        }
        uploadFile() {
                var filechooser = document.getElementById("file-chooser");
                var file = filechooser.files[0];
                if(file) {
                        var promise = uploadObject(bucket,file);
                        this.refs.uploadWindow.await(promise);
                        this.refs.messageUploading.display(promise);
                        var self = this;
                        promise.then(function() {
                                self.refs.uploadWindow.close();
                                self.refs.messageDone.display();
                                searchkit.reloadSearch
                        });
                }
        }
        
        render() {
                return (
                                <div>
                                        <Message duration={5000} ref="messageDone"> 
                                                Done! It can take some time before your document is available for search. Not all documents are searchable.
                                        </Message>
                                        <PromiseMessage ref="messageUploading"> Uploading... </PromiseMessage>
                                        <div className="clickable" onClick={()=>this.handleClick()}> Upload </div>
                                        <Window title="Upload" ref="uploadWindow">
                                                <input id="file-chooser" type="file" name="file" />
                                                <input type="submit" onClick={()=>this.uploadFile()}/>
                                        </Window>
                                </div>
                       )
        }
}
class Window extends React.Component {
        constructor(props) {
                super(props);
                this.state = {visible:false,frozen:false};
        }
        open() {
                this.setState({visible:true});
        }
        close() {
                if(!this.state.frozen) {
                        this.setState({visible:false});
                }
        }
        await(promise) {
                this.setState({frozen:true});
                promise.then(()=>this.setState({frozen:false}));
        }
        render() {
                var display = "none";
                var frozen = "";
                if(this.state.visible) {
                        display="initial";
                }
                if(this.state.frozen) {
                        frozen = "frozen";
                }
                return (
                                <div style={{display: display}} className={"window " + frozen}>
                                        <div className="row">
                                                <div className="title"> {this.props.title} </div>
                                                <div className="closeButton clickable" onClick={()=>this.close()}>X</div>
                                        </div>
                                        {this.props.children}
                                </div>
                       )
        }
}
class Message extends Window {
        display() {
                var duration = 1500;
                if(this.props.duration) {
                        duration = this.props.duration;
                }
                this.setState({visible:true});
                setTimeout(()=>this.setState({visible:false}),duration);
        }
        render() {
                var visibleClassName = "";
                var frozen = "";
                var propClassName = "";
                if(this.state.visible) {
                        visibleClassName = "visible";
                }
                if(this.state.frozen) {
                        frozen = "frozen";
                }
                if(this.props.className) {
                        propClassName = this.props.className;
                }
                return (
                                <div className={"message " + visibleClassName + " " + frozen + " " + propClassName}>
                                                <div className="closeButton clickable" onClick={()=>this.close()}>X</div>
                                    {this.props.children}
                                   </div> 
                       )
        }
}
class PromiseMessage extends Message {
        display(promise) {
                this.setState({visible:true});
                promise.then(()=>this.setState({visible:false}));
        }
}
                

export class SearchPage extends React.Component {
	render(){
		return (
			<SearchkitProvider searchkit={searchkit}>
		    <Layout>
		      <TopBar>
		        <SearchBox
		          autofocus={true}
		          searchOnChange={true}
							placeholder="Search documents..."
		          prefixQueryFields={["Text"]}/>
		      </TopBar>
		      <LayoutBody>
              {/*
		        <SideBar>
							<MenuFilter
								id="type"
								title="Movie Type"
								field="type.raw"
								listComponent={ItemHistogramList}/>
		          <RefinementListFilter
		            id="actors"
		            title="Actors"
		            field="actors.raw"
		            operator="AND"
		            size={10}/>
		        </SideBar>
                */}
		        <LayoutResults>
		          <ActionBar>
		            <ActionBarRow>
		              <HitsStats/>
                      {/*					<SortingSelector options={[
										{label:"Relevance", field:"_score", order:"desc", defaultOption:true},
										{label:"Latest Releases", field:"released", order:"desc"},
										{label:"Earliest Releases", field:"released", order:"asc"}
									]}/>
                                    */}
                      <S3Controls/>
		            </ActionBarRow>
                    {/*
		            <ActionBarRow>
		              <SelectedFilters/>
		              <ResetFilters/>
		            </ActionBarRow>
                    */}
		          </ActionBar>
		          <Hits hitsPerPage={10} itemComponent={FileListItem} highlightFields={["Text"]}
		            sourceFilter={["Bucket","Key","Text"]}/>
		          <NoHits/>
							<Pagination showNumbers={true}/>
		        </LayoutResults>
		      </LayoutBody>
		    </Layout>
		  </SearchkitProvider>
		)
	}
}

